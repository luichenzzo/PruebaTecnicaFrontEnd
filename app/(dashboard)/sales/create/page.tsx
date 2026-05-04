"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Product, Inventory, Sale, CreateSaleRequest } from "@/types";
import { apiClient } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { formatCurrency } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";
import { Search, Plus, Trash2, ArrowLeft, AlertCircle } from "lucide-react";

interface CartItem {
  product: Product;
  inventory: Inventory;
  quantity: number;
  unitPrice: number;
}

export default function CreateSalePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();

  const [availableProducts, setAvailableProducts] = useState<{ product: Product; inventory: Inventory }[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [cart, setCart] = useState<CartItem[]>([]);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [branchId, setBranchId] = useState<string>("");
  const [discountPercentage, setDiscountPercentage] = useState<number>(0);

  useEffect(() => {
    // Determine the branch to operate in
    let currentBranch = user?.branchId;
    if (!currentBranch) {
      // If no branch assigned (e.g. Admin), we either need them to select one or default to a known one.
      // For this implementation, we will fetch inventory and just pick the first branch we see, 
      // or let them type it. Let's assume we can fetch inventory and use a default.
      // In a real app with a /api/branches endpoint, we'd have a selector.
    } else {
      setBranchId(currentBranch);
    }
  }, [user]);

  // Fetch products and inventory
  useEffect(() => {
    const fetchCatalog = async () => {
      if (!branchId && user?.role !== 'ADMIN' && user?.role !== 'MANAGER') return;
      
      setIsLoading(true);
      try {
        let inventoryUrl = "/api/inventory";
        if (user?.role !== "ADMIN" && branchId) {
          inventoryUrl = `/api/inventory/branch/${branchId}`;
        } else if (branchId) {
          inventoryUrl = `/api/inventory?branchId=${branchId}`;
        }
        
        const [invData, productsData] = await Promise.allSettled([
          apiClient<Inventory[]>(inventoryUrl),
          apiClient<Product[]>("/api/products")
        ]);

        if (invData.status === "rejected") {
          throw new Error("Failed to load inventory");
        }

        const inventory = invData.value;
        const products = productsData.status === "fulfilled" ? productsData.value : [];

        // Map inventory to catalog format
        const catalog = inventory.map(inv => {
          const product = products.find(p => p.id === inv.productId);
          const cost = product?.defaultCost ?? 0;
          return {
            product: {
              id: inv.productId,
              sku: inv.productSku,
              name: inv.productName,
              description: product?.description || "",
              unitOfMeasureId: product?.unitOfMeasureId || null,
              supplierId: product?.supplierId || null,
              defaultCost: cost,
              createdById: null,
              updatedById: null,
            },
            inventory: inv
          };
        }).filter(item => item.inventory.quantity > 0); // Only show products with stock

        setAvailableProducts(catalog);
        
        // Auto-set branchId for admin/manager if they didn't have one, based on available inventory
        if (!branchId && inventory.length > 0) {
          setBranchId(inventory[0].branchId);
        }
      } catch (error) {
        toast({ type: "error", title: "Failed to load product catalog" });
      } finally {
        setIsLoading(false);
      }
    };

    fetchCatalog();
  }, [branchId, user, toast]);

  const addToCart = (catalogItem: { product: Product; inventory: Inventory }) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === catalogItem.product.id);
      if (existing) {
        if (existing.quantity + 1 > catalogItem.inventory.quantity) {
          toast({ type: "error", title: "Insufficient stock", message: `Only ${catalogItem.inventory.quantity} available.` });
          return prev;
        }
        return prev.map(item => 
          item.product.id === catalogItem.product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      
      if (catalogItem.inventory.quantity < 1) {
        toast({ type: "error", title: "Out of stock" });
        return prev;
      }

      return [...prev, {
        product: catalogItem.product,
        inventory: catalogItem.inventory,
        quantity: 1,
        unitPrice: catalogItem.product.defaultCost || 0
      }];
    });
  };

  const updateQuantity = (productId: string, newQuantity: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        if (newQuantity > item.inventory.quantity) {
          toast({ type: "error", title: "Insufficient stock", message: `Cannot exceed available stock of ${item.inventory.quantity}.` });
          return item; // Keep old quantity
        }
        return { ...item, quantity: Math.max(1, newQuantity) };
      }
      return item;
    }));
  };

  const updateUnitPrice = (productId: string, newPrice: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        return { ...item, unitPrice: Math.max(0, newPrice) };
      }
      return item;
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const discountAmount = subtotal * ((discountPercentage || 0) / 100);
  const total = subtotal - discountAmount;

  // Validate cart before opening modal
  const handleReviewSale = () => {
    if (cart.length === 0) {
      toast({ type: "warning", title: "Cart is empty" });
      return;
    }

    if (discountPercentage < 0 || discountPercentage > 100) {
      toast({ type: "error", title: "Invalid discount", message: "Discount must be between 0 and 100." });
      return;
    }

    const hasInvalidItems = cart.some(item => item.quantity > item.inventory.quantity);
    if (hasInvalidItems) {
      toast({ type: "error", title: "Invalid quantities", message: "Some items exceed available stock. Please adjust them." });
      return;
    }

    setShowConfirmModal(true);
  };

  const generateSaleNumber = async () => {
    const today = new Date();
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const prefix = `SALE-${dateStr}`;

    try {
      const sales = await apiClient<Sale[]>("/api/sales");
      let maxNum = 0;
      let count = 0;
      
      sales.forEach(s => {
        count++;
        const parts = s.saleNumber.split('-');
        // Check if it has a 3rd part (the suffix)
        if (parts.length >= 3) {
          const num = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      });

      // If we found previous suffixes, increment the max. Otherwise, fallback to total count + 1
      const nextSequence = maxNum > 0 ? maxNum + 1 : count + 1;
      return `${prefix}-${String(nextSequence).padStart(3, '0')}`;
    } catch {
      // Fallback
      return `${prefix}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    }
  };

  // Final submission logic
  const handleConfirmSubmit = async () => {
    setIsSubmitting(true);
    
    try {
      // Step 1: Re-validate stock explicitly against the backend to prevent race conditions
      for (const item of cart) {
        const liveInventory = await apiClient<Inventory>(`/api/inventory/lookup?productId=${item.product.id}&branchId=${branchId}`);
        if (liveInventory.quantity < item.quantity) {
          throw new Error(`Insufficient stock for ${item.product.name}. Available: ${liveInventory.quantity}, Requested: ${item.quantity}.`);
        }
      }

      // Step 2: Generate Sale Number
      const saleNumber = await generateSaleNumber();

      // Step 3: Build payload
      // Apply the global discount percentage evenly to each item's unitPrice
      const discountMultiplier = 1 - ((discountPercentage || 0) / 100);
      
      const payload: CreateSaleRequest = {
        saleNumber,
        branchId,
        items: cart.map(item => ({
          productId: item.product.id,
          quantity: item.quantity,
          unitPrice: Number((item.unitPrice * discountMultiplier).toFixed(2))
        }))
      };

      // Step 4: Submit Sale
      await apiClient<Sale>("/api/sales", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      toast({ type: "success", title: "Sale completed successfully!" });
      setShowConfirmModal(false);
      setCart([]);
      setDiscountPercentage(0);
      
      // Optional: Redirect to sales list
      router.push("/sales");

    } catch (error: any) {
      toast({ 
        type: "error", 
        title: "Sale failed", 
        message: error.message || "An error occurred during final validation." 
      });
      setShowConfirmModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredCatalog = availableProducts.filter(item => 
    item.product.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.product.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-300">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft size={20} />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create New Sale</h1>
          <p className="text-sm text-gray-500 mt-1">Branch: {branchId || "Loading..."}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Product Selection */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Add Products</h2>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <Input 
                placeholder="Search products to add..." 
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {isLoading ? (
              <div className="text-center py-8 text-gray-500">Loading catalog...</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2">
                {filteredCatalog.map(({ product, inventory }) => (
                  <div key={product.id} className="border border-gray-100 rounded-lg p-4 hover:border-blue-200 transition-colors flex justify-between items-center">
                    <div>
                      <p className="font-medium text-gray-900">{product.name}</p>
                      <div className="flex gap-3 text-xs mt-1">
                        <span className="text-gray-500">Stock: {inventory.quantity}</span>
                        <span className="text-blue-600 font-semibold">{formatCurrency(product.defaultCost)}</span>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="secondary"
                      onClick={() => addToCart({ product, inventory })}
                      disabled={inventory.quantity < 1}
                    >
                      <Plus size={16} />
                    </Button>
                  </div>
                ))}
                {filteredCatalog.length === 0 && (
                  <div className="col-span-full text-center py-8 text-gray-500">
                    No products found in stock.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Cart Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Current Sale Items</h2>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="w-32">Quantity</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cart.map((item) => {
                  const isInvalid = item.quantity > item.inventory.quantity;
                  return (
                    <TableRow key={item.product.id} className={isInvalid ? "bg-red-50/50" : ""}>
                      <TableCell>
                        <p className="font-medium">{item.product.name}</p>
                        {isInvalid && (
                          <p className="text-xs text-red-600 flex items-center gap-1 mt-1">
                            <AlertCircle size={12} /> Exceeds stock ({item.inventory.quantity})
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Input 
                          type="number" 
                          min={1} 
                          max={item.inventory.quantity}
                          value={item.quantity}
                          onChange={(e) => updateQuantity(item.product.id, parseInt(e.target.value) || 1)}
                          className={`h-8 ${isInvalid ? "border-red-300 focus:ring-red-500" : ""}`}
                        />
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(item.quantity * item.unitPrice)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => removeFromCart(item.product.id)} className="text-red-500 hover:bg-red-50">
                          <Trash2 size={16} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {cart.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                      Cart is empty. Select products above to start.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Right Column: Summary Panel */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-6">
            <h2 className="text-lg font-semibold mb-6">Order Summary</h2>
            
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              
              {(user?.role === "ADMIN" || user?.role === "MANAGER") && (
                <div className="flex justify-between items-center text-gray-600 pt-2">
                  <span>Discount (%)</span>
                  <Input 
                    type="number" 
                    min={0} 
                    max={100} 
                    className="h-8 w-20 text-right"
                    value={discountPercentage}
                    onChange={(e) => setDiscountPercentage(parseFloat(e.target.value) || 0)}
                  />
                </div>
              )}

              <div className="flex justify-between text-gray-600">
                <span>Discount Amount</span>
                <span className="text-red-500">-{formatCurrency(discountAmount)}</span>
              </div>
              
              <div className="border-t border-gray-200 pt-3 flex justify-between font-bold text-lg text-gray-900">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>

            <Button 
              className="w-full mt-8" 
              size="lg"
              onClick={handleReviewSale}
              disabled={cart.length === 0 || cart.some(i => i.quantity > i.inventory.quantity) || discountPercentage < 0 || discountPercentage > 100}
            >
              Review Sale
            </Button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <Modal 
        isOpen={showConfirmModal} 
        onClose={() => !isSubmitting && setShowConfirmModal(false)}
        title="Confirm Sale"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Please confirm the details of this sale before final submission. This will deduct inventory from branch <span className="font-mono bg-gray-100 px-1">{branchId}</span>.
          </p>
          
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="space-y-2 mb-4">
              {cart.map(item => {
                const discountedPrice = item.unitPrice * (1 - (discountPercentage / 100));
                return (
                  <div key={item.product.id} className="flex justify-between text-sm">
                    <span>{item.quantity}x {item.product.name}</span>
                    <div className="text-right">
                      {discountPercentage > 0 && (
                        <span className="line-through text-xs text-gray-400 mr-2">
                          {formatCurrency(item.quantity * item.unitPrice)}
                        </span>
                      )}
                      <span className="font-medium">{formatCurrency(item.quantity * discountedPrice)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {discountPercentage > 0 && (
              <div className="border-t border-gray-200 pt-2 flex justify-between text-sm text-gray-600">
                <span>Discount Applied</span>
                <span className="text-red-500">{discountPercentage}%</span>
              </div>
            )}
            
            <div className="border-t border-gray-200 pt-2 flex justify-between font-bold text-gray-900">
              <span>Total Amount</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>

          <div className="flex gap-3 justify-end mt-6">
            <Button variant="outline" onClick={() => setShowConfirmModal(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleConfirmSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Validating & Submitting..." : "Confirm & Complete Sale"}
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}

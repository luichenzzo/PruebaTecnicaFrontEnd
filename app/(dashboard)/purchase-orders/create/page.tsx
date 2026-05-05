"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Product, PurchaseOrder, CreatePurchaseOrderRequest, Branch, Supplier } from "@/types";
import { apiClient } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { formatCurrency } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";
import { Search, Plus, Trash2, ArrowLeft } from "lucide-react";

interface POCartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
}

export default function CreatePurchaseOrderPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();

  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  
  const [cart, setCart] = useState<POCartItem[]>([]);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [branchId, setBranchId] = useState<string>("");
  const [supplierId, setSupplierId] = useState<string>("");

  useEffect(() => {
    // Only Admin & Manager can access POs
    if (user && user.role === "OPERATOR") {
      router.push("/");
      return;
    }

    if (user?.branchId) {
      setBranchId(user.branchId);
    }
  }, [user, router]);

  // Fetch products, branches, and suppliers
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [products, fetchedBranches, fetchedSuppliers] = await Promise.all([
          apiClient<Product[]>("/api/products"),
          apiClient<Branch[]>("/api/branches"),
          apiClient<Supplier[]>("/api/suppliers")
        ]);
        
        setAvailableProducts(products);
        setBranches(fetchedBranches);
        setSuppliers(fetchedSuppliers);
        
      } catch (error) {
        toast({ type: "error", title: "Failed to load necessary data" });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [toast]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.product.id === product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, {
        product: product,
        quantity: 1,
        unitPrice: product.defaultCost || 0
      }];
    });
  };

  const updateQuantity = (productId: string, newQuantity: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
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

  const total = cart.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

  const handleReviewPO = () => {
    if (cart.length === 0) {
      toast({ type: "error", title: "Cart is empty" });
      return;
    }

    if (!supplierId.trim()) {
      toast({ type: "error", title: "Supplier required", message: "Please specify a Supplier ID." });
      return;
    }

    if (!branchId.trim()) {
      toast({ type: "error", title: "Branch required", message: "Please specify a Branch ID to receive stock." });
      return;
    }

    setShowConfirmModal(true);
  };

  const generatePONumber = async () => {
    const today = new Date();
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const prefix = `PO-${dateStr}`;

    try {
      const orders = await apiClient<PurchaseOrder[]>("/api/purchase-orders");
      let maxNum = 0;
      let count = 0;
      
      orders.forEach(o => {
        count++;
        const parts = o.orderNumber.split('-');
        if (parts.length >= 3) {
          const num = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      });

      const nextSequence = maxNum > 0 ? maxNum + 1 : count + 1;
      return `${prefix}-${String(nextSequence).padStart(3, '0')}`;
    } catch {
      return `${prefix}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    }
  };

  const handleConfirmSubmit = async () => {
    setIsSubmitting(true);
    
    try {
      const orderNumber = await generatePONumber();

      const payload: CreatePurchaseOrderRequest = {
        orderNumber,
        supplierId,
        branchId,
        items: cart.map(item => ({
          productId: item.product.id,
          quantity: item.quantity,
          unitPrice: item.unitPrice
        }))
      };

      await apiClient<PurchaseOrder>("/api/purchase-orders", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      toast({ type: "success", title: "Purchase Order created!" });
      setShowConfirmModal(false);
      
      router.push("/purchase-orders");

    } catch (error: any) {
      toast({ 
        type: "error", 
        title: "PO creation failed", 
        message: error.message || "An unexpected error occurred." 
      });
      setShowConfirmModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredCatalog = availableProducts.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-300">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft size={20} />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create Purchase Order</h1>
          <p className="text-sm text-gray-500 mt-1">Receive new stock from suppliers</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                <select 
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                >
                  <option value="" disabled>Select a supplier</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Destination Branch</label>
                <select 
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  disabled={user?.role === "MANAGER"} // Managers are locked to their own branch
                >
                  <option value="" disabled>Select a branch</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.code} - {b.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <h2 className="text-lg font-semibold mb-4 border-t pt-6">Add Products</h2>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <Input 
                placeholder="Search global product catalog..." 
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {isLoading ? (
              <div className="text-center py-8 text-gray-500">Loading catalog...</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[300px] overflow-y-auto pr-2">
                {filteredCatalog.map((product) => (
                  <div key={product.id} className="border border-gray-100 rounded-lg p-4 hover:border-blue-200 transition-colors flex justify-between items-center">
                    <div>
                      <p className="font-medium text-gray-900">{product.name}</p>
                      <p className="text-xs text-gray-500 mt-1">SKU: {product.sku}</p>
                    </div>
                    <Button 
                      size="sm" 
                      variant="secondary"
                      onClick={() => addToCart(product)}
                    >
                      <Plus size={16} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">PO Line Items</h2>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="w-32">Qty</TableHead>
                  <TableHead className="text-right w-32">Unit Cost</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cart.map((item) => (
                  <TableRow key={item.product.id}>
                    <TableCell>
                      <p className="font-medium">{item.product.name}</p>
                    </TableCell>
                    <TableCell>
                      <Input 
                        type="number" 
                        min={1} 
                        value={item.quantity}
                        onChange={(e) => updateQuantity(item.product.id, parseInt(e.target.value) || 1)}
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input 
                        type="number" 
                        min={0}
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => updateUnitPrice(item.product.id, parseFloat(e.target.value) || 0)}
                        className="h-8 w-24 ml-auto text-right"
                      />
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(item.quantity * item.unitPrice)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => removeFromCart(item.product.id)} className="text-red-500 hover:bg-red-50">
                        <Trash2 size={16} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {cart.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                      No items added. Select products above to start.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-6">
            <h2 className="text-lg font-semibold mb-6">Order Summary</h2>
            
            <div className="space-y-3 text-sm">
              <div className="flex justify-between font-bold text-lg text-gray-900 border-b pb-4">
                <span>Total Value</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>

            <Button 
              className="w-full mt-6" 
              size="lg"
              onClick={handleReviewPO}
              disabled={cart.length === 0}
            >
              Review PO
            </Button>
          </div>
        </div>
      </div>

      <Modal 
        isOpen={showConfirmModal} 
        onClose={() => !isSubmitting && setShowConfirmModal(false)}
        title="Confirm Purchase Order"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            You are about to issue a Purchase Order to supplier <span className="font-medium bg-gray-100 px-1">{suppliers.find(s => s.id === supplierId)?.name || supplierId}</span>. Stock will be routed to branch <span className="font-medium bg-gray-100 px-1">{branches.find(b => b.id === branchId)?.code || branchId}</span>.
          </p>
          
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="space-y-2 mb-4">
              {cart.map(item => (
                <div key={item.product.id} className="flex justify-between text-sm">
                  <span>{item.quantity}x {item.product.name}</span>
                  <span className="font-medium">{formatCurrency(item.quantity * item.unitPrice)}</span>
                </div>
              ))}
            </div>
            
            <div className="border-t border-gray-200 pt-2 flex justify-between font-bold text-gray-900">
              <span>Total Commitment</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>

          <div className="flex gap-3 justify-end mt-6">
            <Button variant="outline" onClick={() => setShowConfirmModal(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleConfirmSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Issue Purchase Order"}
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}

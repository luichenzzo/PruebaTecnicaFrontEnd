"use client";

import { useEffect, useState } from "react";
import { Product } from "@/types";
import { apiClient } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Plus, Search, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency } from "@/lib/utils";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Modal } from "@/components/ui/Modal";
import { Supplier } from "@/types";

export default function ProductsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [refresh, setRefresh] = useState(0);

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [productForm, setProductForm] = useState({
    sku: "",
    name: "",
    description: "",
    defaultCost: 0,
    supplierId: ""
  });

  useWebSocket("/topic/products", () => {

    setTimeout(() => setRefresh(prev => prev + 1), 800);
  });

  useEffect(() => {
    const fetchProductsAndSuppliers = async () => {
      try {
        const [productsData, suppliersData] = await Promise.all([
          apiClient<Product[]>("/api/products"),
          apiClient<Supplier[]>("/api/suppliers")
        ]);
        setProducts(productsData);
        setSuppliers(suppliersData);
      } catch (error) {
        toast({ type: "error", title: "Failed to load data" });
      } finally {
        setIsLoading(false);
      }
    };

    if (user?.role === "ADMIN") {
      fetchProductsAndSuppliers();
    } else {
      setIsLoading(false);
    }
  }, [user, refresh, toast]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    
    try {
      await apiClient(`/api/products/${id}`, { method: "DELETE" });
      toast({ type: "success", title: "Product deleted" });
      // The websocket update will refetch the list
    } catch (error) {
      toast({ type: "error", title: "Failed to delete product" });
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    
    try {
      const payload = {
        ...productForm,
        supplierId: productForm.supplierId || null
      };

      await apiClient("/api/products", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      
      toast({ type: "success", title: "Product created successfully" });
      setIsCreateModalOpen(false);
      setProductForm({ sku: "", name: "", description: "", defaultCost: 0, supplierId: "" });
    } catch (error: any) {
      toast({ type: "error", title: "Failed to create product", message: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  if (user?.role !== "ADMIN") {
    return <div className="text-red-500">Access Denied. Admins only.</div>;
  }

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your product catalog.</p>
        </div>
        <Button className="gap-2" onClick={() => setIsCreateModalOpen(true)}>
          <Plus size={16} />
          Add Product
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <Input 
              placeholder="Search products..." 
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading products...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Default Cost</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium text-gray-900">{product.sku}</TableCell>
                  <TableCell>{product.name}</TableCell>
                  <TableCell className="text-gray-500 max-w-xs truncate">{product.description}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(product.defaultCost)}</TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleDelete(product.id)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredProducts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                    No products found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <Modal 
        isOpen={isCreateModalOpen} 
        onClose={() => !isProcessing && setIsCreateModalOpen(false)} 
        title="Create New Product"
      >
        <form onSubmit={handleCreateProduct} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
            <Input 
              required 
              value={productForm.sku} 
              onChange={e => setProductForm({...productForm, sku: e.target.value})} 
              placeholder="e.g. PRD-001" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <Input 
              required 
              value={productForm.name} 
              onChange={e => setProductForm({...productForm, name: e.target.value})} 
              placeholder="Product Name" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              rows={3}
              value={productForm.description}
              onChange={e => setProductForm({...productForm, description: e.target.value})}
              placeholder="Detailed description..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default Cost</label>
              <Input 
                type="number" 
                min="0" 
                step="0.01" 
                required 
                value={productForm.defaultCost} 
                onChange={e => setProductForm({...productForm, defaultCost: parseFloat(e.target.value) || 0})} 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supplier (Optional)</label>
              <select 
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                value={productForm.supplierId}
                onChange={(e) => setProductForm({...productForm, supplierId: e.target.value})}
              >
                <option value="">No Supplier</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end pt-4 gap-2 border-t">
            <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)} disabled={isProcessing}>
              Cancel
            </Button>
            <Button type="submit" disabled={isProcessing}>
              {isProcessing ? "Creating..." : "Create Product"}
            </Button>
          </div>
        </form>
      </Modal>

    </div>
  );
}

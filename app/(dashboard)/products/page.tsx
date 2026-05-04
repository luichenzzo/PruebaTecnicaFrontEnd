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

export default function ProductsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const data = await apiClient<Product[]>("/api/products");
        setProducts(data);
      } catch (error) {
        toast({ type: "error", title: "Failed to load products" });
      } finally {
        setIsLoading(false);
      }
    };

    if (user?.role === "ADMIN") {
      fetchProducts();
    } else {
      setIsLoading(false);
    }
  }, [user, toast]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    
    try {
      await apiClient(`/api/products/${id}`, { method: "DELETE" });
      setProducts(products.filter(p => p.id !== id));
      toast({ type: "success", title: "Product deleted" });
    } catch (error) {
      toast({ type: "error", title: "Failed to delete product" });
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
        <Button className="gap-2">
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
    </div>
  );
}

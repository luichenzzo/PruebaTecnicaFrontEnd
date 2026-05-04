"use client";

import { useEffect, useState } from "react";
import { Inventory } from "@/types";
import { apiClient } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { Input } from "@/components/ui/Input";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";

export default function InventoryPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  // We'll store mapped inventory that includes defaultCost from products
  const [inventory, setInventory] = useState<(Inventory & { defaultCost?: number })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchInventory = async () => {
      try {
        let url = "/api/inventory";
        if (user?.role !== "ADMIN" && user?.branchId) {
          url = `/api/inventory/branch/${user.branchId}`;
        }
        
        // Fetch inventory and products concurrently
        const [invData, productsData] = await Promise.allSettled([
          apiClient<Inventory[]>(url),
          apiClient<Product[]>("/api/products")
        ]);

        if (invData.status === "rejected") {
          throw new Error("Failed to load inventory");
        }

        const inv = invData.value;
        const prods = productsData.status === "fulfilled" ? productsData.value : [];

        // Map the default cost from products into the inventory data
        const mappedInventory = inv.map(item => {
          const product = prods.find(p => p.id === item.productId);
          return {
            ...item,
            defaultCost: product?.defaultCost
          };
        });

        setInventory(mappedInventory);
      } catch (error) {
        toast({ type: "error", title: "Failed to load inventory" });
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      fetchInventory();
    }
  }, [user, toast]);

  const filteredInventory = inventory.filter(p => 
    p.productName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.productSku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
        <p className="text-sm text-gray-500 mt-1">Track stock levels across branches.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <Input 
              placeholder="Search by product name or SKU..." 
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading inventory...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Product Name</TableHead>
                <TableHead>Branch ID</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Reserved</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInventory.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium text-gray-900">{item.productSku}</TableCell>
                  <TableCell>{item.productName}</TableCell>
                  <TableCell className="text-gray-500 font-mono text-xs">{item.branchId}</TableCell>
                  <TableCell className="text-right text-gray-600">
                    {item.productDefaultCost !== undefined 
                      ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(item.productDefaultCost) 
                      : item.defaultCost !== undefined
                        ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(item.defaultCost)
                        : "-"}
                  </TableCell>
                  <TableCell className="text-right font-medium text-gray-900">{item.quantity}</TableCell>
                  <TableCell className="text-right text-gray-500">{item.reserved}</TableCell>
                  <TableCell className="text-right">
                    {item.quantity < 10 ? (
                      <Badge variant="destructive">Low Stock</Badge>
                    ) : item.quantity < 50 ? (
                      <Badge variant="warning">Moderate</Badge>
                    ) : (
                      <Badge variant="success">Healthy</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filteredInventory.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    No inventory records found.
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

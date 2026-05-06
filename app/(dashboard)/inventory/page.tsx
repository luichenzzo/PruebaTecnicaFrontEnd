"use client";

import { useEffect, useState } from "react";
import { Inventory, Product, Branch } from "@/types";
import { apiClient } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { Input } from "@/components/ui/Input";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { useWebSocket } from "@/hooks/useWebSocket";
export default function InventoryPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  // We'll store mapped inventory that includes defaultCost from products and branchCode
  const [inventory, setInventory] = useState<(Inventory & { defaultCost?: number; branchCode?: string })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [refresh, setRefresh] = useState(0);

  // Custom thresholds mapping: inventoryId -> threshold value
  const [thresholds, setThresholds] = useState<Record<string, number>>({});

  // Load thresholds from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("optiplant-low-stock-thresholds");
      if (saved) {
        try {
          setThresholds(JSON.parse(saved));
        } catch (e) {
          console.error("Failed to parse thresholds", e);
        }
      }
    }
  }, []);

  const updateThreshold = (inventoryId: string, value: number) => {
    const newThresholds = { ...thresholds, [inventoryId]: Math.max(0, value) };
    setThresholds(newThresholds);
    if (typeof window !== "undefined") {
      localStorage.setItem("optiplant-low-stock-thresholds", JSON.stringify(newThresholds));
    }
  };

  // Listen to real-time updates from WebSocket
  useWebSocket("/topic/inventory", () => {
    console.log("[Inventory] Received update, refetching...");
    toast({ type: "success", title: "Real-time update received!", message: "Inventory has been refreshed." });
    setTimeout(() => setRefresh(prev => prev + 1), 800); // 800ms delay to ensure backend transaction is fully committed
  });

  useEffect(() => {
    const fetchInventory = async () => {
      try {
        let url = "/api/inventory";
        const t = Date.now();
        if (user?.role !== "ADMIN" && user?.branchId) {
          url = `/api/inventory/branch/${user.branchId}`;
        }

        // Fetch inventory, products, and branches concurrently
        const [invData, productsData, branchesData] = await Promise.allSettled([
          apiClient<Inventory[]>(`${url}?_t=${t}`),
          apiClient<Product[]>(`/api/products?_t=${t}`),
          apiClient<Branch[]>(`/api/branches?_t=${t}`)
        ]);

        if (invData.status === "rejected") {
          throw new Error("Failed to load inventory");
        }

        const inv = invData.value;
        const prods = productsData.status === "fulfilled" ? productsData.value : [];
        const branches = branchesData.status === "fulfilled" ? branchesData.value : [];

        // Map the default cost from products and branch code from branches into the inventory data
        const mappedInventory = inv.map(item => {
          const product = prods.find(p => p.id === item.productId);
          const branch = branches.find(b => b.id === item.branchId);
          return {
            ...item,
            defaultCost: product?.defaultCost,
            branchCode: branch?.code || item.branchId // Fallback to branchId if branch not found
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
  }, [user, refresh, toast]);

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
                <TableHead>Branch Code</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                {user?.role === "MANAGER" && (
                  <TableHead className="text-right">Low Stock At</TableHead>
                )}
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInventory.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium text-gray-900">{item.productSku}</TableCell>
                  <TableCell>{item.productName}</TableCell>
                  <TableCell className="text-gray-500 font-mono text-xs">{item.branchCode}</TableCell>
                  <TableCell className="text-right text-gray-600">
                    {item.productDefaultCost !== undefined
                      ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(item.productDefaultCost)
                      : item.defaultCost !== undefined
                        ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(item.defaultCost)
                        : "-"}
                  </TableCell>
                  <TableCell className="text-right font-medium text-gray-900">{item.quantity}</TableCell>
                  {user?.role === "MANAGER" && (
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        className="w-20 ml-auto h-8 text-right"
                        min={0}
                        value={thresholds[item.id] !== undefined ? thresholds[item.id] : 10}
                        onChange={(e) => updateThreshold(item.id, parseInt(e.target.value) || 0)}
                      />
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    {item.quantity <= (thresholds[item.id] !== undefined ? thresholds[item.id] : 10) ? (
                      <Badge variant="destructive">Low Stock</Badge>
                    ) : item.quantity <= (thresholds[item.id] !== undefined ? thresholds[item.id] * 2 : 50) ? (
                      <Badge variant="warning">Moderate</Badge>
                    ) : (
                      <Badge variant="success">Healthy</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filteredInventory.length === 0 && (
                <TableRow>
                  <TableCell colSpan={user?.role === "MANAGER" ? 7 : 6} className="text-center py-8 text-gray-500">
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

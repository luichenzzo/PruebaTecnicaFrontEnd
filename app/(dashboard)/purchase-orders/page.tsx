"use client";

import { useEffect, useState } from "react";
import { PurchaseOrder } from "@/types";
import { apiClient } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency } from "@/lib/utils";

export default function PurchaseOrdersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const data = await apiClient<PurchaseOrder[]>("/api/purchase-orders");
        setOrders(data);
      } catch (error) {
        toast({ type: "error", title: "Failed to load purchase orders" });
      } finally {
        setIsLoading(false);
      }
    };

    if (user?.role === "ADMIN" || user?.role === "MANAGER") {
      fetchOrders();
    } else {
      setIsLoading(false);
    }
  }, [user, toast]);

  if (user?.role !== "ADMIN" && user?.role !== "MANAGER") {
    return <div className="text-red-500">Access Denied.</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
          <p className="text-sm text-gray-500 mt-1">Manage stock inwards from suppliers.</p>
        </div>
        <Button className="gap-2">
          <Plus size={16} />
          Create PO
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading purchase orders...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO Number</TableHead>
                <TableHead>Supplier ID</TableHead>
                <TableHead>Branch ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((po) => (
                <TableRow key={po.id}>
                  <TableCell className="font-medium text-gray-900">{po.orderNumber}</TableCell>
                  <TableCell className="text-gray-500 font-mono text-xs">{po.supplierId}</TableCell>
                  <TableCell className="text-gray-500 font-mono text-xs">{po.branchId}</TableCell>
                  <TableCell>
                    <Badge variant={po.status === "RECEIVED" ? "success" : "warning"}>
                      {po.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold text-gray-900">
                    {formatCurrency(po.total)}
                  </TableCell>
                </TableRow>
              ))}
              {orders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                    No purchase orders found.
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

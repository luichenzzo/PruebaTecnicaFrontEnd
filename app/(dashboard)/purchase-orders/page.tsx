"use client";

import { useEffect, useState } from "react";
import { PurchaseOrder, Branch, Supplier } from "@/types";
import { apiClient } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";
import { useWebSocket } from "@/hooks/useWebSocket";

export default function PurchaseOrdersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<(PurchaseOrder & { branchCode?: string, supplierName?: string })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [refresh, setRefresh] = useState(0);

  useWebSocket("/topic/purchase-orders", () => {

    setTimeout(() => setRefresh(prev => prev + 1), 800);
  });

  const fetchOrders = async () => {
    try {
      // Fetch purchase orders, branches, and suppliers concurrently
      const [ordersData, branchesData, suppliersData] = await Promise.allSettled([
        apiClient<PurchaseOrder[]>("/api/purchase-orders"),
        apiClient<Branch[]>("/api/branches"),
        apiClient<Supplier[]>("/api/suppliers")
      ]);

      if (ordersData.status === "rejected") {
        throw new Error("Failed to load purchase orders");
      }

      const orders = ordersData.value;
      const branches = branchesData.status === "fulfilled" ? branchesData.value : [];
      const suppliers = suppliersData.status === "fulfilled" ? suppliersData.value : [];

      // Map branch code and supplier name into orders data
      const mappedOrders = orders.map(order => {
        const branch = branches.find(b => b.id === order.branchId);
        const supplier = suppliers.find(s => s.id === order.supplierId);
        return {
          ...order,
          branchCode: branch?.code || order.branchId, // Fallback to branchId if branch not found
          supplierName: supplier?.name || order.supplierId
        };
      });

      setOrders(mappedOrders);
    } catch (error) {
      toast({ type: "error", title: "Failed to load purchase orders" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === "ADMIN" || user?.role === "MANAGER") {
      fetchOrders();
    } else {
      setIsLoading(false);
    }
  }, [user, refresh, toast]);

  const handleAction = async (action: "receive" | "cancel") => {
    if (!selectedOrder) return;

    if (action === "cancel") {
      const confirmMsg = "Are you sure you want to CANCEL this Purchase Order? (Use this if you received less than expected or the order is defective).";
      if (!window.confirm(confirmMsg)) return;
    } else {
      const confirmMsg = "Did you receive the EXPECTED amount for all items?";
      if (!window.confirm(confirmMsg)) {
        // If they click cancel on the confirm prompt, it means they didn't receive the expected amount.
        // We can offer them to cancel it instead.
        if (window.confirm("Since you received less than expected, the system requires canceling this PO. Do you want to cancel it now?")) {
          return handleAction("cancel");
        }
        return;
      }
    }

    setIsProcessing(true);
    try {
      await apiClient(`/api/purchase-orders/${selectedOrder.id}/${action}`, {
        method: "POST"
      });
      
      toast({ 
        type: "success", 
        title: `PO ${action === 'receive' ? 'Received' : 'Canceled'} successfully!` 
      });
      
      setSelectedOrder(null);
      await fetchOrders(); // Refresh table
    } catch (error: any) {
      toast({ type: "error", title: `Failed to ${action} PO`, message: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  if (user?.role !== "ADMIN" && user?.role !== "MANAGER") {
    return <div className="text-red-500">Access Denied.</div>;
  }

  const filteredOrders = orders.filter(po => statusFilter === "ALL" || po.status === statusFilter);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
          <p className="text-sm text-gray-500 mt-1">Manage stock inwards from suppliers.</p>
        </div>
        <Button className="gap-2" onClick={() => window.location.href = '/purchase-orders/create'}>
          <Plus size={16} />
          Create PO
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700">Filter by Status</h2>
          <select 
            className="h-9 rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="RECEIVED">Received</option>
            <option value="CANCELED">Canceled</option>
          </select>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading purchase orders...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO Number</TableHead>
                <TableHead>Supplier Name</TableHead>
                <TableHead>Branch Code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map((po) => (
                <TableRow 
                  key={po.id}
                  className="cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setSelectedOrder(po)}
                >
                  <TableCell className="font-medium text-gray-900">{po.orderNumber}</TableCell>
                  <TableCell className="text-gray-900 font-medium text-xs">{po.supplierName}</TableCell>
                  <TableCell className="text-gray-500 font-mono text-xs">{po.branchCode}</TableCell>
                  <TableCell>
                    <Badge variant={
                      po.status === "RECEIVED" ? "success" : 
                      po.status.includes("CANCEL") ? "destructive" : "warning"
                    }>
                      {po.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold text-gray-900">
                    {formatCurrency(po.total)}
                  </TableCell>
                </TableRow>
              ))}
              {filteredOrders.length === 0 && (
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

      {/* PO Details Modal */}
      {selectedOrder && (
        <Modal
          isOpen={!!selectedOrder}
          onClose={() => !isProcessing && setSelectedOrder(null)}
          title={`PO Details: ${selectedOrder.orderNumber}`}
        >
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Status</p>
                <Badge variant={
                  selectedOrder.status === "RECEIVED" ? "success" : 
                  selectedOrder.status.includes("CANCEL") ? "destructive" : "warning"
                } className="mt-1">
                  {selectedOrder.status}
                </Badge>
              </div>
              <div>
                <p className="text-gray-500">Branch Code</p>
                <p className="font-mono mt-1">{selectedOrder.branchCode}</p>
              </div>
              <div>
                <p className="text-gray-500">Supplier Name</p>
                <p className="font-medium mt-1">{(selectedOrder as any).supplierName || selectedOrder.supplierId}</p>
              </div>
            </div>

            <div>
              <h3 className="font-medium text-gray-900 mb-3 border-b pb-2">Line Items</h3>
              <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden max-h-[300px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedOrder.items.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <p className="font-medium">{item.productName}</p>
                          <p className="text-xs text-gray-500">{item.productSku}</p>
                        </TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(item.lineTotal || (item.quantity * item.unitPrice))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex justify-between items-center border-t pt-4">
              <span className="font-semibold text-gray-900 text-lg">Total Amount</span>
              <span className="font-bold text-xl text-blue-600">{formatCurrency(selectedOrder.total)}</span>
            </div>
            
            <div className="flex justify-between items-center pt-2">
              <div>
                {/* Action Buttons for non-finalized orders */}
                {(selectedOrder.status !== "RECEIVED" && selectedOrder.status !== "CANCELED") && (
                  <div className="flex gap-2">
                    <Button 
                      variant="destructive" 
                      onClick={() => handleAction("cancel")}
                      disabled={isProcessing}
                    >
                      Cancel PO
                    </Button>
                    <Button 
                      variant="default"
                      onClick={() => handleAction("receive")}
                      disabled={isProcessing}
                    >
                      Receive PO
                    </Button>
                  </div>
                )}
              </div>
              <Button variant="outline" onClick={() => setSelectedOrder(null)} disabled={isProcessing}>Close</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

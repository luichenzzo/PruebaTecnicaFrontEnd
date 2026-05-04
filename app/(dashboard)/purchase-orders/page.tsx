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
import { Modal } from "@/components/ui/Modal";

export default function PurchaseOrdersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

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

  useEffect(() => {
    if (user?.role === "ADMIN" || user?.role === "MANAGER") {
      fetchOrders();
    } else {
      setIsLoading(false);
    }
  }, [user, toast]);

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
                <TableRow 
                  key={po.id}
                  className="cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setSelectedOrder(po)}
                >
                  <TableCell className="font-medium text-gray-900">{po.orderNumber}</TableCell>
                  <TableCell className="text-gray-500 font-mono text-xs">{po.supplierId}</TableCell>
                  <TableCell className="text-gray-500 font-mono text-xs">{po.branchId}</TableCell>
                  <TableCell>
                    <Badge variant={
                      po.status === "RECEIVED" ? "success" : 
                      po.status === "CANCELED" ? "destructive" : "warning"
                    }>
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
                  selectedOrder.status === "CANCELED" ? "destructive" : "warning"
                } className="mt-1">
                  {selectedOrder.status}
                </Badge>
              </div>
              <div>
                <p className="text-gray-500">Branch ID</p>
                <p className="font-mono mt-1">{selectedOrder.branchId}</p>
              </div>
              <div>
                <p className="text-gray-500">Supplier ID</p>
                <p className="font-mono mt-1">{selectedOrder.supplierId}</p>
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

"use client";

import { useEffect, useState } from "react";
import { Transfer, Branch, CreateTransferRequest } from "@/types";
import { apiClient } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { ArrowRightLeft, Plus, Inbox, Send } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Input } from "@/components/ui/Input";

export default function TransfersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState<"incoming" | "outgoing" | "all">(user?.role === "ADMIN" ? "all" : "incoming");
  
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // State to track modified received quantities
  const [receivedQuantities, setReceivedQuantities] = useState<Record<string, number>>({});

  // Reset quantities when a transfer is selected
  useEffect(() => {
    if (selectedTransfer) {
      const initialQuantities: Record<string, number> = {};
      selectedTransfer.items.forEach(item => {
        initialQuantities[item.productId] = item.quantity;
      });
      setReceivedQuantities(initialQuantities);
    }
  }, [selectedTransfer]);

  const fetchTransfers = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      let transfersPromise;
      const t = Date.now();
      if (user.role === "ADMIN") {
        transfersPromise = apiClient<Transfer[]>(`/api/transfers?_t=${t}`);
      } else {
        if (activeTab === "incoming") {
          transfersPromise = apiClient<Transfer[]>(`/api/transfers/to/${user.branchId}?_t=${t}`);
        } else {
          transfersPromise = apiClient<Transfer[]>(`/api/transfers/from/${user.branchId}?_t=${t}`);
        }
      }

      const [transfersData, branchesData] = await Promise.allSettled([
        transfersPromise,
        apiClient<Branch[]>(`/api/branches?_t=${t}`)
      ]);

      if (transfersData.status === "rejected") {
        throw new Error("Failed to load transfers");
      }

      const transfersResult = transfersData.value || [];
      const branches = branchesData.status === "fulfilled" ? branchesData.value : [];

      const mappedTransfers = transfersResult.map(transfer => {
        const fromBranch = branches.find(b => b.id === transfer.fromBranchId);
        const toBranch = branches.find(b => b.id === transfer.toBranchId);
        return {
          ...transfer,
          fromBranchCode: fromBranch?.code || transfer.fromBranchCode || transfer.fromBranchId,
          toBranchCode: toBranch?.code || transfer.toBranchCode || transfer.toBranchId
        };
      });

      setTransfers(mappedTransfers);
    } catch (error) {
      toast({ type: "error", title: "Failed to load transfers" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === "ADMIN" || user?.role === "MANAGER") {
      fetchTransfers();
    } else {
      setIsLoading(false);
    }
  }, [user, activeTab, toast]);

  useWebSocket("/topic/transfers", () => {
    console.log("[Transfers] Received update, refetching...");
    toast({ type: "success", title: "Real-time update received!", message: "Transfers list has been refreshed." });
    setTimeout(() => {
      if (user?.role === "ADMIN" || user?.role === "MANAGER") {
        fetchTransfers();
      }
    }, 800); // 800ms delay to ensure backend transaction is fully committed
  });

  const handleAction = async (action: "approve" | "cancel") => {
    if (!selectedTransfer) return;
    
    setIsProcessing(true);
    try {
      await apiClient(`/api/transfers/${selectedTransfer.id}/${action}`, {
        method: "POST"
      });
      
      toast({ 
        type: "success", 
        title: `Transfer ${action === 'approve' ? 'approved (in transit)' : 'cancelled'} successfully!` 
      });
      
      setSelectedTransfer(null);
      await fetchTransfers();
    } catch (error: any) {
      toast({ type: "error", title: `Failed to ${action} transfer`, message: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReceive = async () => {
    if (!selectedTransfer) return;
    setIsProcessing(true);

    try {
      // Check if any received quantity is less than original
      const isPartial = selectedTransfer.items.some(
        item => receivedQuantities[item.productId] < item.quantity
      );

      if (!isPartial) {
        // Full receive
        await apiClient(`/api/transfers/${selectedTransfer.id}/complete`, {
          method: "POST"
        });
        toast({ type: "success", title: "Transfer completed successfully!" });
      } else {
        // Partial receive workaround
        // 1. Cancel the original transfer to restore stock to origin branch
        await apiClient(`/api/transfers/${selectedTransfer.id}/cancel`, {
          method: "POST"
        });

        // 2. Create a new completed transfer with adjusted quantities
        const payload: CreateTransferRequest = {
          transferNumber: `${selectedTransfer.transferNumber}-ADJ`,
          fromBranchId: selectedTransfer.fromBranchId,
          toBranchId: selectedTransfer.toBranchId,
          items: selectedTransfer.items.map(item => ({
            productId: item.productId,
            quantity: receivedQuantities[item.productId] || 0,
            unitPrice: 0 // Default unitPrice
          })).filter(item => item.quantity > 0) // Only send items that were actually received
        };

        if (payload.items.length > 0) {
          await apiClient("/api/transfers/complete", {
            method: "POST",
            body: JSON.stringify(payload)
          });
          toast({ type: "success", title: "Partial transfer recorded successfully!" });
        } else {
          toast({ type: "success", title: "Transfer cancelled. No items were received." });
        }
      }

      setSelectedTransfer(null);
      await fetchTransfers();
    } catch (error: any) {
      toast({ type: "error", title: "Failed to receive transfer", message: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  if (user?.role !== "ADMIN" && user?.role !== "MANAGER") {
    return <div className="text-red-500">Access Denied.</div>;
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED": return "success";
      case "IN_TRANSIT": return "warning";
      case "CANCELLED": return "destructive";
      default: return "default"; // PENDING or REQUESTED
    }
  };

  const canCancel = (selectedTransfer: Transfer) => {
    if (selectedTransfer.status === "COMPLETED" || selectedTransfer.status === "CANCELLED") return false;
    // Both origin and destination managers can cancel before it's received
    return selectedTransfer.fromBranchId === user?.branchId || selectedTransfer.toBranchId === user?.branchId;
  };

  const updateReceivedQuantity = (productId: string, qty: number) => {
    setReceivedQuantities(prev => ({
      ...prev,
      [productId]: Math.max(0, qty)
    }));
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transfers</h1>
          <p className="text-sm text-gray-500 mt-1">Manage stock movements between branches.</p>
        </div>
        <Button className="gap-2" onClick={() => window.location.href = '/transfers/create'}>
          <Plus size={16} />
          Create Transfer
        </Button>
      </div>

      {user?.role === "MANAGER" && (
        <div className="flex gap-4 border-b border-gray-200">
          <button
            onClick={() => setActiveTab("incoming")}
            className={`pb-4 px-2 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === "incoming" 
                ? "border-blue-600 text-blue-600" 
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <Inbox size={16} />
            Incoming (To My Branch)
          </button>
          <button
            onClick={() => setActiveTab("outgoing")}
            className={`pb-4 px-2 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === "outgoing" 
                ? "border-blue-600 text-blue-600" 
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <Send size={16} />
            Outgoing (From My Branch)
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading transfers...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Transfer Number</TableHead>
                <TableHead>Origin Branch</TableHead>
                <TableHead></TableHead>
                <TableHead>Destination Branch</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Items</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transfers.map((trf) => (
                <TableRow 
                  key={trf.id}
                  className="cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setSelectedTransfer(trf)}
                >
                  <TableCell className="font-medium text-gray-900">{trf.transferNumber}</TableCell>
                  <TableCell className="text-gray-500 font-mono text-xs">{trf.fromBranchCode}</TableCell>
                  <TableCell className="text-gray-300"><ArrowRightLeft size={16} /></TableCell>
                  <TableCell className="text-gray-500 font-mono text-xs">{trf.toBranchCode}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadge(trf.status)}>
                      {trf.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-gray-600">
                    {trf.items.length} item(s)
                  </TableCell>
                </TableRow>
              ))}
              {transfers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    No transfers found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Transfer Details Modal */}
      {selectedTransfer && (
        <Modal
          isOpen={!!selectedTransfer}
          onClose={() => !isProcessing && setSelectedTransfer(null)}
          title={`Transfer Details: ${selectedTransfer.transferNumber}`}
        >
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Status</p>
                <Badge variant={getStatusBadge(selectedTransfer.status)} className="mt-1">
                  {selectedTransfer.status.replace("_", " ")}
                </Badge>
              </div>
              <div></div>
              <div>
                <p className="text-gray-500">Origin Branch</p>
                <p className="font-mono mt-1">{selectedTransfer.fromBranchCode}</p>
              </div>
              <div>
                <p className="text-gray-500">Destination Branch</p>
                <p className="font-mono mt-1">{selectedTransfer.toBranchCode}</p>
              </div>
            </div>

            <div>
              <h3 className="font-medium text-gray-900 mb-3 border-b pb-2">Line Items</h3>
              <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden max-h-[300px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Shipped Qty</TableHead>
                      {selectedTransfer.status === "IN_TRANSIT" && selectedTransfer.toBranchId === user?.branchId && (
                        <TableHead className="text-right">Actual Received</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedTransfer.items.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <p className="font-medium">{item.productName}</p>
                          <p className="text-xs text-gray-500">{item.productSku}</p>
                        </TableCell>
                        <TableCell className="text-right font-medium">{item.quantity}</TableCell>
                        {selectedTransfer.status === "IN_TRANSIT" && selectedTransfer.toBranchId === user?.branchId && (
                          <TableCell className="text-right">
                            <Input 
                              type="number"
                              className="w-20 ml-auto text-right h-8"
                              min={0}
                              max={item.quantity}
                              value={receivedQuantities[item.productId] ?? item.quantity}
                              onChange={(e) => updateReceivedQuantity(item.productId, parseInt(e.target.value) || 0)}
                            />
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t">
              <div>
                {/* Actions: Admins can't interact, Managers can based on branch logic */}
                {user?.role === "MANAGER" && (
                  <div className="flex gap-2">
                    {canCancel(selectedTransfer) && (
                      <Button 
                        variant="destructive"
                        onClick={() => handleAction("cancel")}
                        disabled={isProcessing}
                      >
                        Cancel / Deny
                      </Button>
                    )}
                    
                    {/* Approve (Set In Transit) if user is origin branch manager */}
                    {selectedTransfer.fromBranchId === user.branchId && 
                     selectedTransfer.status !== "IN_TRANSIT" && 
                     selectedTransfer.status !== "COMPLETED" && 
                     selectedTransfer.status !== "CANCELLED" && (
                      <Button 
                        variant="default"
                        onClick={() => handleAction("approve")}
                        disabled={isProcessing}
                      >
                        Approve & Ship
                      </Button>
                    )}
                    
                    {/* Complete (Receive) if user is destination branch manager */}
                    {selectedTransfer.toBranchId === user.branchId && selectedTransfer.status === "IN_TRANSIT" && (
                      <Button 
                        variant="default"
                        onClick={handleReceive}
                        disabled={isProcessing}
                      >
                        Receive
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <Button variant="outline" onClick={() => setSelectedTransfer(null)} disabled={isProcessing}>Close</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

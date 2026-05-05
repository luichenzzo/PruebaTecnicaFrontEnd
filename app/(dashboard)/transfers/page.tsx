"use client";

import { useEffect, useState } from "react";
import { Transfer, Branch } from "@/types";
import { apiClient } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { ArrowRightLeft, Plus, Inbox, Send } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { useWebSocket } from "@/hooks/useWebSocket";

export default function TransfersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Tab states for Manager: "incoming" | "outgoing"
  // For admin, we default to "all"
  const [activeTab, setActiveTab] = useState<"incoming" | "outgoing" | "all">(user?.role === "ADMIN" ? "all" : "incoming");
  
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchTransfers = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      let transfersPromise;
      if (user.role === "ADMIN") {
        transfersPromise = apiClient<Transfer[]>("/api/transfers");
      } else {
        // Manager logic
        if (activeTab === "incoming") {
          transfersPromise = apiClient<Transfer[]>(`/api/transfers/to/${user.branchId}`);
        } else {
          transfersPromise = apiClient<Transfer[]>(`/api/transfers/from/${user.branchId}`);
        }
      }

      const [transfersData, branchesData] = await Promise.allSettled([
        transfersPromise,
        apiClient<Branch[]>("/api/branches")
      ]);

      if (transfersData.status === "rejected") {
        throw new Error("Failed to load transfers");
      }

      const transfersResult = transfersData.value || [];
      const branches = branchesData.status === "fulfilled" ? branchesData.value : [];

      // Map branch codes into transfers data
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

  // Listen to real-time updates from WebSocket
  useWebSocket("/topic/transfers", () => {
    console.log("[Transfers] Received update, refetching...");
    toast({ type: "success", title: "Real-time update received!", message: "Transfers list has been refreshed." });
    if (user?.role === "ADMIN" || user?.role === "MANAGER") {
      fetchTransfers();
    }
  });

  const handleAction = async (action: "approve" | "complete") => {
    if (!selectedTransfer) return;
    
    setIsProcessing(true);
    try {
      await apiClient(`/api/transfers/${selectedTransfer.id}/${action}`, {
        method: "POST"
      });
      
      toast({ 
        type: "success", 
        title: `Transfer ${action === 'approve' ? 'approved (in transit)' : 'completed'} successfully!` 
      });
      
      setSelectedTransfer(null);
      await fetchTransfers();
    } catch (error: any) {
      toast({ type: "error", title: `Failed to ${action} transfer`, message: error.message });
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
      default: return "default"; // PENDING or REQUESTED
    }
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
                      <TableHead className="text-right">Qty</TableHead>
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
                    {/* Approve (Set In Transit) if user is origin branch manager */}
                    {selectedTransfer.fromBranchId === user.branchId && selectedTransfer.status !== "IN_TRANSIT" && selectedTransfer.status !== "COMPLETED" && (
                      <Button 
                        variant="default"
                        onClick={() => handleAction("approve")}
                        disabled={isProcessing}
                      >
                        Approve & Ship (Set In Transit)
                      </Button>
                    )}
                    {/* Complete (Receive) if user is destination branch manager */}
                    {selectedTransfer.toBranchId === user.branchId && selectedTransfer.status === "IN_TRANSIT" && (
                      <Button 
                        variant="default"
                        onClick={() => handleAction("complete")}
                        disabled={isProcessing}
                      >
                        Receive (Set Completed)
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

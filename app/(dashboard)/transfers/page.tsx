"use client";

import { useEffect, useState } from "react";
import { Transfer, Branch } from "@/types";
import { apiClient } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { ArrowRightLeft, Plus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";

export default function TransfersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [transfers, setTransfers] = useState<(Transfer & { fromBranchCode?: string; toBranchCode?: string })[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTransfers = async () => {
      try {
        // Fetch transfers and branches concurrently
        const [transfersData, branchesData] = await Promise.allSettled([
          apiClient<Transfer[]>("/api/transfers"),
          apiClient<Branch[]>("/api/branches")
        ]);

        if (transfersData.status === "rejected") {
          throw new Error("Failed to load transfers");
        }

        const transfers = transfersData.value;
        const branches = branchesData.status === "fulfilled" ? branchesData.value : [];

        // Map branch codes into transfers data
        const mappedTransfers = transfers.map(transfer => {
          const fromBranch = branches.find(b => b.id === transfer.fromBranchId);
          const toBranch = branches.find(b => b.id === transfer.toBranchId);
          return {
            ...transfer,
            fromBranchCode: fromBranch?.code || transfer.fromBranchId,
            toBranchCode: toBranch?.code || transfer.toBranchId
          };
        });

        setTransfers(mappedTransfers);
      } catch (error) {
        toast({ type: "error", title: "Failed to load transfers" });
      } finally {
        setIsLoading(false);
      }
    };

    if (user?.role === "ADMIN" || user?.role === "MANAGER") {
      fetchTransfers();
    } else {
      setIsLoading(false);
    }
  }, [user, toast]);

  if (user?.role !== "ADMIN" && user?.role !== "MANAGER") {
    return <div className="text-red-500">Access Denied.</div>;
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED": return "success";
      case "IN_TRANSIT": return "warning";
      default: return "default";
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transfers</h1>
          <p className="text-sm text-gray-500 mt-1">Manage stock movements between branches.</p>
        </div>
        <Button className="gap-2">
          <Plus size={16} />
          Create Transfer
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading transfers...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Transfer Number</TableHead>
                <TableHead>Origin Branch Code</TableHead>
                <TableHead></TableHead>
                <TableHead>Destination Branch Code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Items</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transfers.map((trf) => (
                <TableRow key={trf.id}>
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
    </div>
  );
}

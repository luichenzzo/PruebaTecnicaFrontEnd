"use client";

import { useEffect, useState } from "react";
import { InventoryMovement } from "@/types";
import { apiClient } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight, ArrowRightLeft, Settings2 } from "lucide-react";
import { useWebSocket } from "@/hooks/useWebSocket";

export default function MovementsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);

  useWebSocket("/topic/inventory-movements", () => {

    setTimeout(() => setRefresh(prev => prev + 1), 800);
  });

  useEffect(() => {
    const fetchMovements = async () => {
      try {
        const data = await apiClient<InventoryMovement[]>("/api/inventory-movements");
        setMovements(data);
      } catch (error) {
        toast({ type: "error", title: "Failed to load inventory movements" });
      } finally {
        setIsLoading(false);
      }
    };

    if (user?.role === "ADMIN" || user?.role === "MANAGER") {
      fetchMovements();
    } else {
      setIsLoading(false);
    }
  }, [user, refresh, toast]);

  if (user?.role !== "ADMIN" && user?.role !== "MANAGER") {
    return <div className="text-red-500">Access Denied.</div>;
  }

  const getMovementIcon = (category: string) => {
    switch (category) {
      case "IN": return <ArrowDownRight size={16} className="text-green-600" />;
      case "OUT": return <ArrowUpRight size={16} className="text-red-600" />;
      case "TRANSFER": return <ArrowRightLeft size={16} className="text-blue-600" />;
      default: return <Settings2 size={16} className="text-gray-600" />;
    }
  };

  const getMovementBadge = (category: string) => {
    switch (category) {
      case "IN": return "success";
      case "OUT": return "destructive";
      case "TRANSFER": return "default";
      default: return "warning";
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Inventory Movements</h1>
        <p className="text-sm text-gray-500 mt-1">Full traceability of all stock changes.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading movements...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead>Reference</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.map((mov) => (
                <TableRow key={mov.id}>
                  <TableCell className="text-gray-500 whitespace-nowrap">
                    {formatDate(mov.createdAt)}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-gray-900">{mov.productName}</p>
                    <p className="text-xs text-gray-500 font-mono">{mov.productSku}</p>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getMovementIcon(mov.movementCategory)}
                      <Badge variant={getMovementBadge(mov.movementCategory)}>
                        {mov.movementType.replace("_", " ")}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <span className={mov.movementCategory === "IN" ? "text-green-600" : mov.movementCategory === "OUT" ? "text-red-600" : "text-gray-900"}>
                      {mov.movementCategory === "IN" ? "+" : mov.movementCategory === "OUT" ? "-" : ""}{mov.quantity}
                    </span>
                  </TableCell>
                  <TableCell>
                    {mov.reference ? (
                      <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-600">
                        {mov.reference}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-sm">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {movements.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                    No movements recorded yet.
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

"use client";

import { useEffect, useState } from "react";
import { Sale } from "@/types";
import { apiClient } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function SalesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSales = async () => {
      try {
        const data = await apiClient<Sale[]>("/api/sales");
        setSales(data);
      } catch (error) {
        toast({ type: "error", title: "Failed to load sales" });
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      fetchSales();
    }
  }, [user, toast]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales</h1>
          <p className="text-sm text-gray-500 mt-1">Manage and view sales orders.</p>
        </div>
        <Button className="gap-2" onClick={() => window.location.href = '/sales/create'}>
          <Plus size={16} />
          Create Sale
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading sales...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sale Number</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Items</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell className="font-medium text-gray-900">{sale.saleNumber}</TableCell>
                  <TableCell className="text-gray-500 font-mono text-xs">{sale.branchId}</TableCell>
                  <TableCell>
                    <Badge variant={sale.status === "COMPLETED" ? "success" : "default"}>
                      {sale.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-gray-600">
                    {sale.items.length} item(s)
                  </TableCell>
                  <TableCell className="text-right font-semibold text-gray-900">
                    {formatCurrency(sale.total)}
                  </TableCell>
                </TableRow>
              ))}
              {sales.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                    No sales records found.
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

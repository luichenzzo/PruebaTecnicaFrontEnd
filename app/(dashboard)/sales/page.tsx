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

import { Modal } from "@/components/ui/Modal";

export default function SalesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

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
                <TableRow 
                  key={sale.id} 
                  className="cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setSelectedSale(sale)}
                >
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

      {/* Sale Details Modal */}
      {selectedSale && (
        <Modal
          isOpen={!!selectedSale}
          onClose={() => setSelectedSale(null)}
          title={`Sale Details: ${selectedSale.saleNumber}`}
        >
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Status</p>
                <Badge variant={selectedSale.status === "COMPLETED" ? "success" : "default"} className="mt-1">
                  {selectedSale.status}
                </Badge>
              </div>
              <div>
                <p className="text-gray-500">Branch ID</p>
                <p className="font-mono mt-1">{selectedSale.branchId}</p>
              </div>
            </div>

            <div>
              <h3 className="font-medium text-gray-900 mb-3 border-b pb-2">Line Items</h3>
              <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedSale.items.map((item, idx) => (
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
              <span className="font-bold text-xl text-blue-600">{formatCurrency(selectedSale.total)}</span>
            </div>
            
            <div className="flex justify-end pt-2">
              <Button onClick={() => setSelectedSale(null)}>Close</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

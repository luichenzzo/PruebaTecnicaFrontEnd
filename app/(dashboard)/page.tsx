"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api/client";
import { ReportsOverview, Inventory } from "@/types";
import { useAuth } from "@/lib/auth/AuthContext";
import { Package, Boxes, ShoppingCart, Truck, ArrowRightLeft, History, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

// Helper components for Dashboard
function StatCard({ title, value, icon: Icon, colorClass }: any) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex items-center gap-4">
      <div className={`p-4 rounded-full ${colorClass}`}>
        <Icon size={24} />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
      </div>
    </div>
  );
}

export default function DashboardHome() {
  const { user } = useAuth();
  const [overview, setOverview] = useState<ReportsOverview | null>(null);
  const [lowStock, setLowStock] = useState<Inventory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        let inventoryUrl = "/api/inventory";
        if (user?.role !== "ADMIN" && user?.branchId) {
          inventoryUrl = `/api/inventory/branch/${user.branchId}`;
        }

        if (user?.role === "ADMIN" || user?.role === "MANAGER") {
          const [overviewData, inventoryData] = await Promise.all([
            apiClient<ReportsOverview>("/api/reports/overview"),
            apiClient<Inventory[]>(inventoryUrl),
          ]);
          setOverview(overviewData);
          // Simple client-side filter for low stock (assuming quantity < 10 for demo)
          setLowStock(inventoryData.filter((item) => item.quantity < 10));
        } else {
           // Operator only gets inventory for their branch
           const inventoryData = await apiClient<Inventory[]>(inventoryUrl);
           setLowStock(inventoryData.filter((item) => item.quantity < 10));
        }
      } catch (error) {
        console.error("Failed to load dashboard data", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      fetchData();
    }
  }, [user]);

  if (isLoading) {
    return <div className="text-gray-500">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard Overview</h1>

      {(user?.role === "ADMIN" || user?.role === "MANAGER") && overview && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard title="Products" value={overview.totalProducts} icon={Package} colorClass="bg-blue-100 text-blue-600" />
          <StatCard title="Branches" value={overview.totalBranches} icon={Boxes} colorClass="bg-indigo-100 text-indigo-600" />
          <StatCard title="Sales" value={overview.totalSales} icon={ShoppingCart} colorClass="bg-green-100 text-green-600" />
          <StatCard title="Purchases" value={overview.totalPurchaseOrders} icon={Truck} colorClass="bg-purple-100 text-purple-600" />
          <StatCard title="Transfers" value={overview.totalTransfers} icon={ArrowRightLeft} colorClass="bg-orange-100 text-orange-600" />
          <StatCard title="Movements" value={overview.totalInventoryMovements} icon={History} colorClass="bg-gray-100 text-gray-600" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="text-amber-500" />
            <h2 className="text-lg font-semibold text-gray-900">Low Stock Alerts</h2>
          </div>
          {lowStock.length === 0 ? (
            <p className="text-gray-500 text-sm">No low stock items detected.</p>
          ) : (
            <div className="space-y-4">
              {lowStock.map((item) => (
                <div key={item.id} className="flex justify-between items-center border-b border-gray-100 pb-2 last:border-0">
                  <div>
                    <p className="font-medium text-gray-900">{item.productName}</p>
                    <p className="text-xs text-gray-500">{item.productSku}</p>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800">
                      {item.quantity} in stock
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api/client";
import { ReportsOverview, Inventory, Sale, Transfer, Branch } from "@/types";
import { useAuth } from "@/lib/auth/AuthContext";
import { Package, Boxes, ShoppingCart, Truck, ArrowRightLeft, History, AlertTriangle, TrendingUp, TrendingDown, Activity, BarChart3, Printer } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

// Helper components for Dashboard
function StatCard({ title, value, icon: Icon, colorClass }: any) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex items-center gap-4 transition-transform hover:scale-105">
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
  
  // Analytics States
  const [monthlySales, setMonthlySales] = useState<{ month: string; total: number }[]>([]);
  const [topProducts, setTopProducts] = useState<{ name: string; qty: number }[]>([]);
  const [bottomProducts, setBottomProducts] = useState<{ name: string; qty: number }[]>([]);
  const [activeTransfers, setActiveTransfers] = useState<Transfer[]>([]);
  const [branchPerformance, setBranchPerformance] = useState<{ branchName: string; total: number }[]>([]);

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      try {
        let inventoryUrl = "/api/inventory";
        let salesUrl = "/api/sales";

        if (user.role !== "ADMIN" && user.branchId) {
          inventoryUrl = `/api/inventory/branch/${user.branchId}`;
          salesUrl = `/api/sales/branch/${user.branchId}`;
        }

        const promises: Promise<any>[] = [
          apiClient<Inventory[]>(inventoryUrl),
        ];

        if (user.role === "ADMIN" || user.role === "MANAGER") {
          promises.push(apiClient<ReportsOverview>("/api/reports/overview"));
          promises.push(apiClient<Sale[]>(salesUrl));
          
          if (user.role === "ADMIN") {
             promises.push(apiClient<Transfer[]>("/api/transfers"));
             promises.push(apiClient<Branch[]>("/api/branches"));
          } else {
             // Managers get both incoming and outgoing for their branch
             promises.push(Promise.all([
               apiClient<Transfer[]>(`/api/transfers/to/${user.branchId}`),
               apiClient<Transfer[]>(`/api/transfers/from/${user.branchId}`)
             ]).then(([inT, outT]) => [...inT, ...outT]));
          }
        }

        const results = await Promise.allSettled(promises);
        
        // 1. Inventory & Low Stock
        const inventoryData = results[0].status === "fulfilled" ? results[0].value : [];
        
        let customThresholds: Record<string, number> = {};
        if (typeof window !== "undefined") {
          const saved = localStorage.getItem("optiplant-low-stock-thresholds");
          if (saved) {
            try {
              customThresholds = JSON.parse(saved);
            } catch(e) {}
          }
        }
        
        setLowStock(inventoryData.filter((item: any) => {
          const threshold = customThresholds[item.id] !== undefined ? customThresholds[item.id] : 10;
          return item.quantity <= threshold;
        }));

        if (user.role === "ADMIN" || user.role === "MANAGER") {
          // 2. Overview
          const overviewData = results[1].status === "fulfilled" ? results[1].value : null;
          setOverview(overviewData);

          // 3. Sales Analytics
          const salesData = results[2].status === "fulfilled" ? results[2].value : [];
          const completedSales = salesData.filter((s: Sale) => s.status === "COMPLETED");
          
          const salesByMonth: Record<string, number> = {};
          const productDemand: Record<string, number> = {};
          
          completedSales.forEach((sale: Sale) => {
             // Parse SL-YYYYMMDD-XXX
             const parts = sale.saleNumber.split('-');
             if (parts.length >= 2) {
               const datePart = parts[1];
               if (datePart.length === 8) {
                 const monthKey = `${datePart.substring(0,4)}-${datePart.substring(4,6)}`;
                 salesByMonth[monthKey] = (salesByMonth[monthKey] || 0) + sale.total;
               }
             }

             // Parse items for rotation
             sale.items.forEach(item => {
               productDemand[item.productName] = (productDemand[item.productName] || 0) + item.quantity;
             });
          });
          
          // Monthly Chart Data
          const monthlyArr = Object.entries(salesByMonth).map(([month, total]) => ({ month, total })).sort((a,b) => a.month.localeCompare(b.month));
          setMonthlySales(monthlyArr.slice(-6)); // Keep last 6 months

          // Top/Bottom Products
          const demandArr = Object.entries(productDemand).map(([name, qty]) => ({ name, qty })).sort((a,b) => b.qty - a.qty);
          setTopProducts(demandArr.slice(0, 5));
          setBottomProducts(demandArr.slice(-5).reverse());

          // 4. Transfers Impact
          const transfersData = results[3].status === "fulfilled" ? results[3].value : [];
          // Deduplicate if manager got overlapping arrays
          const uniqueTransfers = Array.from(new Map(transfersData.map(t => [t.id, t])).values());
          setActiveTransfers(uniqueTransfers.filter((t: Transfer) => t.status === "IN_TRANSIT"));

          // 5. Branch Performance (Admin Only)
          if (user.role === "ADMIN") {
             const branchesData = results[4].status === "fulfilled" ? results[4].value : [];
             const branchPerf: Record<string, number> = {};
             completedSales.forEach((sale: Sale) => {
                branchPerf[sale.branchId] = (branchPerf[sale.branchId] || 0) + sale.total;
             });
             const perfArr = Object.entries(branchPerf).map(([id, total]) => {
                const b = branchesData.find(x => x.id === id);
                return { branchName: b ? b.code : id, total };
             }).sort((a,b) => b.total - a.total);
             setBranchPerformance(perfArr);
          }
        }

      } catch (error) {
        console.error("Failed to load dashboard data", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center animate-pulse">
        <div className="text-gray-500 font-medium text-lg">Loading detailed analytics...</div>
      </div>
    );
  }

  // Find max value for scaling bar charts
  const maxMonthlySales = monthlySales.length > 0 ? Math.max(...monthlySales.map(m => m.total)) : 0;
  const maxBranchSales = branchPerformance.length > 0 ? Math.max(...branchPerformance.map(b => b.total)) : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 print:space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Analytics</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full font-medium shadow-sm">
            {user?.role} Profile
          </span>
          {user?.role === "ADMIN" && (
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 bg-gray-900 text-white px-4 py-1.5 rounded-full text-sm font-medium hover:bg-gray-800 transition-colors shadow-sm"
            >
              <Printer size={16} />
              Export as PDF
            </button>
          )}
        </div>
      </div>
      <div className="hidden print:block mb-6 border-b pb-4">
        <h1 className="text-3xl font-bold text-gray-900">OptiPlant Dashboard Report</h1>
        <p className="text-gray-500 mt-1">Generated on {new Date().toLocaleDateString()}</p>
      </div>

      {/* Top Stat Cards */}
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

      {/* Main Analytics Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Sales Volume Bar Chart */}
        {(user?.role === "ADMIN" || user?.role === "MANAGER") && (
          <div className="xl:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-6">
              <BarChart3 className="text-blue-500" />
              <h2 className="text-lg font-semibold text-gray-900">Sales Volume (Last 6 Months)</h2>
            </div>
            
            {monthlySales.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-gray-500">No sales data available</div>
            ) : (
              <div className="flex items-end gap-4 h-64 mt-4">
                {monthlySales.map((item, idx) => {
                  const heightPercent = maxMonthlySales > 0 ? (item.total / maxMonthlySales) * 100 : 0;
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-2 group">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity text-xs font-semibold text-gray-700 mb-1">
                        {formatCurrency(item.total)}
                      </div>
                      <div className="w-full bg-blue-100 rounded-t-md relative flex-1 flex items-end">
                        <div 
                          className="w-full bg-blue-500 rounded-t-md transition-all duration-1000 ease-out" 
                          style={{ height: `${heightPercent}%` }}
                        ></div>
                      </div>
                      <div className="text-xs text-gray-500 font-medium">{item.month}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Restock Indicators (Low Stock) */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="text-amber-500" />
            <h2 className="text-lg font-semibold text-gray-900">Restock Indicators</h2>
          </div>
          <p className="text-xs text-gray-500 mb-4">Products currently at or below their low stock threshold.</p>
          
          <div className="flex-1 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
            {lowStock.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-500 text-sm">Stock levels look good.</div>
            ) : (
              <div className="space-y-3">
                {lowStock.map((item) => (
                  <div key={item.id} className="flex justify-between items-center p-3 rounded-lg border border-red-100 bg-red-50/50">
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{item.productName}</p>
                      <p className="text-xs text-gray-500">{item.productSku} • {item.branchCode}</p>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-800 shadow-sm">
                      {item.quantity} left
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Secondary Analytics Grid */}
      {(user?.role === "ADMIN" || user?.role === "MANAGER") && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Active Transfers Impact */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="text-orange-500" />
              <h2 className="text-lg font-semibold text-gray-900">Active Transfers Impact</h2>
            </div>
            
            <div className="text-3xl font-bold text-gray-900 mb-4 border-b pb-4">
              {activeTransfers.length} <span className="text-sm font-medium text-gray-500">In Transit</span>
            </div>
            
            <div className="space-y-3 max-h-[220px] overflow-y-auto">
              {activeTransfers.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No active transfers.</p>
              ) : (
                activeTransfers.slice(0, 5).map(trf => (
                  <div key={trf.id} className="flex justify-between text-sm p-2 bg-gray-50 rounded-md">
                    <div>
                      <span className="font-mono font-medium">{trf.fromBranchCode}</span> 
                      <span className="text-gray-400 mx-2">→</span> 
                      <span className="font-mono font-medium">{trf.toBranchCode}</span>
                    </div>
                    <span className="font-semibold text-orange-600">{trf.items.reduce((s,i) => s + i.quantity, 0)} items</span>
                  </div>
                ))
              )}
              {activeTransfers.length > 5 && (
                 <p className="text-xs text-center text-gray-400 mt-2">+{activeTransfers.length - 5} more...</p>
              )}
            </div>
          </div>

          {/* Product Rotation (Demand) */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="text-green-500" />
              <h2 className="text-lg font-semibold text-gray-900">Inventory Rotation</h2>
            </div>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">High Demand (Top 3)</h3>
                <div className="space-y-2">
                  {topProducts.length === 0 && <p className="text-xs text-gray-500">Not enough data.</p>}
                  {topProducts.slice(0, 3).map((p, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm">
                      <span className="text-gray-800 truncate pr-4">{p.name}</span>
                      <span className="font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded">{p.qty} sold</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Low Demand (Bottom 3)</h3>
                <div className="space-y-2">
                  {bottomProducts.length === 0 && <p className="text-xs text-gray-500">Not enough data.</p>}
                  {bottomProducts.slice(0, 3).map((p, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm">
                      <span className="text-gray-800 truncate pr-4">{p.name}</span>
                      <span className="font-semibold text-red-500 bg-red-50 px-2 py-0.5 rounded">{p.qty} sold</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Branch Performance (Admin Only) */}
          {user?.role === "ADMIN" && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="text-purple-500" />
                <h2 className="text-lg font-semibold text-gray-900">Branch Revenue</h2>
              </div>
              
              <div className="space-y-4 mt-6">
                {branchPerformance.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center">No sales data.</p>
                ) : (
                  branchPerformance.map((branch, idx) => {
                    const widthPct = maxBranchSales > 0 ? (branch.total / maxBranchSales) * 100 : 0;
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium text-gray-700">{branch.branchName}</span>
                          <span className="font-semibold text-gray-900">{formatCurrency(branch.total)}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div 
                            className="bg-purple-500 h-2 rounded-full transition-all duration-1000" 
                            style={{ width: `${widthPct}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

        </div>
      )}
      
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1; 
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #d1d5db; 
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #9ca3af; 
        }
      `}</style>
    </div>
  );
}

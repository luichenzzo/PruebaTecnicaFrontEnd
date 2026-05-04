"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  Boxes,
  ShoppingCart,
  Truck,
  ArrowRightLeft,
  History,
} from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";

const navItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard, roles: ["ADMIN", "MANAGER", "OPERATOR"] },
  { name: "Products", href: "/products", icon: Package, roles: ["ADMIN"] },
  { name: "Inventory", href: "/inventory", icon: Boxes, roles: ["ADMIN", "MANAGER", "OPERATOR"] },
  { name: "Sales", href: "/sales", icon: ShoppingCart, roles: ["ADMIN", "MANAGER", "OPERATOR"] },
  { name: "Purchase Orders", href: "/purchase-orders", icon: Truck, roles: ["ADMIN", "MANAGER"] },
  { name: "Transfers", href: "/transfers", icon: ArrowRightLeft, roles: ["ADMIN", "MANAGER"] },
  { name: "Movements", href: "/movements", icon: History, roles: ["ADMIN", "MANAGER"] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-full hidden md:flex shrink-0">
      <div className="h-16 flex items-center px-6 border-b border-gray-200">
        <div className="flex items-center gap-2 text-blue-600 font-bold text-xl tracking-tight">
          <Boxes size={24} />
          <span>OptiPlant</span>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          if (!user || !item.roles.includes(user.role)) return null;

          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              )}
            >
              <Icon size={20} className={cn(isActive ? "text-blue-600" : "text-gray-400")} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-200 bg-gray-50/50">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-gray-900 truncate">{user?.fullName}</span>
          <span className="text-xs text-gray-500 truncate">{user?.email}</span>
        </div>
      </div>
    </aside>
  );
}

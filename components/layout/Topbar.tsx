"use client";

import { useAuth } from "@/lib/auth/AuthContext";
import { Button } from "@/components/ui/Button";
import { LogOut, Menu } from "lucide-react";

export function Topbar() {
  const { user, logout } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 lg:px-8 shrink-0 print:hidden">
      <div className="flex items-center md:hidden">
        <Button variant="ghost" size="icon" className="-ml-2">
          <Menu size={20} />
        </Button>
      </div>
      
      <div className="flex-1" />

      <div className="flex items-center gap-4">
        {user && (
          <div className="hidden sm:flex items-center gap-2 text-sm">
            <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold">
              {user.role}
            </span>
          </div>
        )}
        <Button variant="ghost" size="sm" onClick={logout} className="text-gray-600 hover:text-red-600">
          <LogOut size={16} className="mr-2" />
          Logout
        </Button>
      </div>
    </header>
  );
}

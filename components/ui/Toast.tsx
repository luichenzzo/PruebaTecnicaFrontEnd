"use client";

import * as React from "react";
import { X, CheckCircle, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastType = "success" | "error" | "info";

interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextType {
  toast: (options: Omit<ToastMessage, "id">) => void;
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);

  const toast = React.useCallback(({ type, title, message }: Omit<ToastMessage, "id">) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, type, title, message }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "flex items-start gap-3 p-4 rounded-lg shadow-lg border w-80 animate-in slide-in-from-right-full fade-in duration-300",
              {
                "bg-white border-green-200": t.type === "success",
                "bg-white border-red-200": t.type === "error",
                "bg-white border-blue-200": t.type === "info",
              }
            )}
          >
            {t.type === "success" && <CheckCircle className="text-green-500 mt-0.5" size={20} />}
            {t.type === "error" && <AlertCircle className="text-red-500 mt-0.5" size={20} />}
            {t.type === "info" && <Info className="text-blue-500 mt-0.5" size={20} />}
            
            <div className="flex-1">
              <h3 className={cn("text-sm font-semibold", {
                "text-green-900": t.type === "success",
                "text-red-900": t.type === "error",
                "text-blue-900": t.type === "info",
              })}>{t.title}</h3>
              {t.message && <p className="text-sm mt-1 text-gray-600">{t.message}</p>}
            </div>
            
            <button onClick={() => removeToast(t.id)} className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (context === undefined) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

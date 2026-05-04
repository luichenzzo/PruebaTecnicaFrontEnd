"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, AuthResponse } from "@/types";
import { apiClient } from "@/lib/api/client";
import { useRouter, usePathname } from "next/navigation";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (data: AuthResponse) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem("token");
      
      if (!token) {
        setIsLoading(false);
        if (pathname && !pathname.startsWith('/login') && !pathname.startsWith('/register')) {
           router.push('/login');
        }
        return;
      }

      try {
        const user = await apiClient<User>("/api/auth/me");
        setUser(user);
      } catch (error) {
        console.error("Failed to verify token", error);
        localStorage.removeItem("token");
        if (pathname && !pathname.startsWith('/login') && !pathname.startsWith('/register')) {
           router.push('/login');
        }
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, [pathname, router]);

  const login = (data: AuthResponse) => {
    localStorage.setItem("token", data.token);
    setUser(data.user);
    router.push("/");
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

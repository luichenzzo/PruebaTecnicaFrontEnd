"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
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

  const login = useCallback((data: AuthResponse) => {
    localStorage.setItem("token", data.token);
    setUser(data.user);
    router.push("/");
  }, [router]);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setUser(null);
    router.push("/login");
  }, [router]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (user) {
        timeoutId = setTimeout(() => {
          logout();
        }, 5 * 60 * 1000); // 5 minutes
      }
    };

    const handleActivity = () => {
      resetTimer();
    };

    if (user) {
      resetTimer();
      const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
      events.forEach(event => {
        window.addEventListener(event, handleActivity);
      });

      return () => {
        if (timeoutId) clearTimeout(timeoutId);
        events.forEach(event => {
          window.removeEventListener(event, handleActivity);
        });
      };
    }
  }, [user, logout]);

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

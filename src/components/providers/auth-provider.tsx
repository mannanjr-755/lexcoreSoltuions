"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import api from "@/lib/axios";
import type { AuthUser } from "@/types/auth";
import { PageLoading } from "@/components/ui/skeleton";

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  refresh: async () => {},
  logout: async () => {}
});

const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const logout = useCallback(async () => {
    try {
      await api.post("/api/auth/logout");
    } catch {
      // ignore network errors on logout
    }
    setUser(null);
    window.location.assign("/login");
  }, []);

  const resetSessionTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void logout();
    }, SESSION_TIMEOUT_MS);
  }, [logout]);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get("/api/auth/me");
      setUser({
        id: res.data.user.id,
        email: res.data.user.email,
        role: res.data.user.role,
        fullName: res.data.user.fullName,
        profilePhoto: res.data.user.profilePhoto
      });
      resetSessionTimer();
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [resetSessionTimer]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (loading) return;
    if (!user && !pathname.startsWith("/login")) {
      router.replace("/login");
    }
  }, [loading, user, pathname, router]);

  useEffect(() => {
    if (!user) return;
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const;
    const onActivity = () => resetSessionTimer();
    events.forEach((event) => window.addEventListener(event, onActivity));
    resetSessionTimer();
    return () => {
      events.forEach((event) => window.removeEventListener(event, onActivity));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [user, resetSessionTimer]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#09090B]">
        <PageLoading />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#09090B]">
        <PageLoading />
      </div>
    );
  }

  return <AuthContext.Provider value={{ user, loading, refresh, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

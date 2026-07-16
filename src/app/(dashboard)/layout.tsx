"use client";

import { AuthProvider } from "@/components/providers/auth-provider";
import { ShellProvider, useShell } from "@/components/providers/shell-provider";
import { ToastProvider } from "@/components/ui/toast";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { cn } from "@/lib/utils";
import { useState } from "react";

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { collapsed } = useShell();
  const [unreadCount, setUnreadCount] = useState(0);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <Sidebar unreadCount={unreadCount} />
      <div
        className={cn(
          "flex min-h-screen min-w-0 flex-col transition-[padding] duration-300",
          collapsed ? "lg:pl-[112px]" : "lg:pl-[320px]"
        )}
      >
        <Topbar unreadCount={unreadCount} setUnreadCount={setUnreadCount} />
        <main className="flex-1 overflow-y-auto px-3 pb-8 pt-4 md:px-5 lg:px-6">{children}</main>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ShellProvider>
        <ToastProvider>
          <DashboardShell>{children}</DashboardShell>
        </ToastProvider>
      </ShellProvider>
    </AuthProvider>
  );
}

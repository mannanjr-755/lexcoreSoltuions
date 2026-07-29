"use client";

import { AuthProvider } from "@/components/providers/auth-provider";
import { ShellProvider, useShell } from "@/components/providers/shell-provider";
import { ToastProvider } from "@/components/ui/toast";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { cn } from "@/lib/utils";

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { collapsed } = useShell();

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <Sidebar />
      <div
        className={cn(
          "flex min-h-screen min-w-0 flex-col transition-all duration-300",
          collapsed ? "lg:pl-[72px]" : "lg:pl-[260px]"
        )}
      >
        <Topbar />
        <main className="flex-1 px-4 pb-8 pt-5 md:px-6 lg:px-8">{children}</main>
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

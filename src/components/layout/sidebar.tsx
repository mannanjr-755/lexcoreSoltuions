"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  UserCircle,
  Settings,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Bell,
  Wallet,
  CalendarDays,
  Plus,
  FolderOpen,
  BarChart3,
  Search
} from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";
import { useShell } from "@/components/providers/shell-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LexcoreLogo } from "@/components/brand/lexcore-logo";

type NavChild = { href: string; label: string };
type NavItem = {
  href?: string;
  label: string;
  icon: React.ElementType;
  children?: NavChild[];
};

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  {
    label: "CRM",
    icon: Users,
    children: [
      { href: "/crm/customers", label: "Customers" },
      { href: "/quotations", label: "Quotations" }
    ]
  },
  {
    label: "Delivery",
    icon: FolderKanban,
    children: [
      { href: "/projects", label: "Projects" },
      { href: "/tasks", label: "Tasks" }
    ]
  },
  {
    label: "People",
    icon: CalendarDays,
    children: [
      { href: "/employees", label: "Employees" },
      { href: "/departments", label: "Departments" },
      { href: "/attendance", label: "Attendance" },
      { href: "/payroll", label: "Payroll" }
    ]
  },
  {
    label: "Finance",
    icon: Wallet,
    children: [
      { href: "/finance/expenses", label: "Expenses" },
      { href: "/finance/invoices", label: "Invoices" },
      { href: "/finance/payments", label: "Payments" }
    ]
  },
  { href: "/documents", label: "Documents", icon: FolderOpen },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/notifications", label: "Alerts", icon: Bell },
  { href: "/profile", label: "Profile", icon: UserCircle },
  { href: "/settings", label: "Settings", icon: Settings }
];

const flatLinks = navItems.flatMap((item) =>
  item.children ? item.children : item.href ? [{ href: item.href, label: item.label }] : []
);

export function Sidebar({ unreadCount = 0 }: { unreadCount?: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { collapsed, mobileOpen, toggleCollapsed, setMobileOpen } = useShell();
  const [navQuery, setNavQuery] = useState("");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    CRM: true,
    Delivery: true,
    Finance: true,
    People: false
  });

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const filtered = useMemo(() => {
    if (!navQuery.trim()) return null;
    const q = navQuery.toLowerCase();
    return flatLinks.filter((l) => l.label.toLowerCase().includes(q));
  }, [navQuery]);

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-40 bg-[#08142D]/35 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 88 : 292 }}
        transition={{ type: "spring", stiffness: 280, damping: 30 }}
        className={cn(
          "floating-sidebar fixed z-50 flex flex-col rounded-[24px] p-3",
          "inset-y-3 left-3",
          mobileOpen ? "translate-x-0" : "-translate-x-[120%] lg:translate-x-0"
        )}
      >
        <div className={cn("mb-4 px-2 pt-1", collapsed && "flex justify-center px-0")}>
          {collapsed ? <LexcoreLogo size="sm" /> : <LexcoreLogo showWordmark />}
        </div>

        {!collapsed && (
          <div className="mb-3 space-y-2 px-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#94A3B8]" />
              <Input
                value={navQuery}
                onChange={(e) => setNavQuery(e.target.value)}
                placeholder="Search menu..."
                className="h-10 rounded-[12px] bg-[#F8FAFC] pl-9 text-xs"
              />
            </div>
            <Button
              size="sm"
              className="h-10 w-full justify-start"
              onClick={() => {
                setMobileOpen(false);
                router.push("/crm/customers");
              }}
            >
              <Plus className="size-4" /> Quick Create
            </Button>
          </div>
        )}

        {collapsed && (
          <Button
            size="icon"
            className="mb-3 mx-auto"
            onClick={() => {
              setMobileOpen(false);
              router.push("/crm/customers");
            }}
          >
            <Plus className="size-4" />
          </Button>
        )}

        <nav className="flex-1 space-y-1 overflow-y-auto px-1 pb-3">
          {filtered ? (
            filtered.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "block rounded-[12px] px-3 py-2.5 text-sm transition",
                  isActive(link.href) ? "sidebar-active" : "text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
                )}
              >
                {link.label}
              </Link>
            ))
          ) : (
            navItems.map((item) => {
              const Icon = item.icon;
              if (item.children) {
                const groupOpen = openGroups[item.label] ?? false;
                const childActive = item.children.some((c) => isActive(c.href));
                return (
                  <div key={item.label} className="space-y-1">
                    <button
                      type="button"
                      onClick={() =>
                        collapsed
                          ? router.push(item.children![0].href)
                          : setOpenGroups((p) => ({ ...p, [item.label]: !groupOpen }))
                      }
                      className={cn(
                        "flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-sm transition",
                        childActive ? "sidebar-active" : "text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]",
                        collapsed && "justify-center px-2"
                      )}
                    >
                      <Icon className="size-[18px] shrink-0" />
                      {!collapsed && (
                        <>
                          <span className="flex-1 text-left font-medium">{item.label}</span>
                          <ChevronDown className={cn("size-4 opacity-60 transition", groupOpen && "rotate-180")} />
                        </>
                      )}
                    </button>
                    <AnimatePresence initial={false}>
                      {!collapsed && groupOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden pl-3"
                        >
                          {item.children.map((child) => (
                            <Link
                              key={child.href}
                              href={child.href}
                              onClick={() => setMobileOpen(false)}
                              className={cn(
                                "mb-1 flex items-center gap-2 rounded-[10px] px-3 py-2 text-[13px] transition",
                                isActive(child.href)
                                  ? "bg-[rgba(212,175,55,0.12)] text-[#C9A227]"
                                  : "text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
                              )}
                            >
                              <span className="h-1 w-1 rounded-full bg-current opacity-70" />
                              {child.label}
                            </Link>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href!}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-sm font-medium transition",
                    isActive(item.href!) ? "sidebar-active" : "text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]",
                    collapsed && "justify-center px-2"
                  )}
                >
                  <Icon className="size-[18px] shrink-0" />
                  {!collapsed && (
                    <span className="flex flex-1 items-center justify-between">
                      {item.label}
                      {item.href === "/notifications" && unreadCount > 0 && (
                        <span className="rounded-full bg-[#D4AF37] px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {unreadCount}
                        </span>
                      )}
                    </span>
                  )}
                </Link>
              );
            })
          )}
        </nav>

        <div className="mt-auto space-y-2 border-t border-[#E2E8F0] pt-3">
          <div
            className={cn(
              "flex items-center gap-3 rounded-[14px] border border-[#E2E8F0] bg-[#F8FAFC] p-2.5",
              collapsed && "justify-center"
            )}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#08142D] to-[#1E3A8A] text-sm font-bold text-[#E6C86E]">
              {user?.fullName?.charAt(0) ?? "A"}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[#0F172A]">{user?.fullName ?? "Admin"}</p>
                <p className="truncate text-[11px] text-[#64748B]">{user?.email}</p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => void logout()}
            className={cn(
              "flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-sm text-red-500 transition hover:bg-red-50",
              collapsed && "justify-center px-2"
            )}
          >
            <LogOut className="size-[18px]" />
            {!collapsed && <span>Logout</span>}
          </button>

          <button
            type="button"
            onClick={toggleCollapsed}
            className="hidden w-full items-center justify-center rounded-[12px] border border-[#E2E8F0] p-2 text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#0F172A] lg:flex"
          >
            {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          </button>
        </div>
      </motion.aside>
    </>
  );
}

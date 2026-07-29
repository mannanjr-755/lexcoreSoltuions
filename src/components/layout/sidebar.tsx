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
  FolderOpen,
  BarChart3,
  Search,
  DollarSign,
  MessageSquare
} from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";
import { useShell } from "@/components/providers/shell-provider";
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
    label: "Projects",
    icon: FolderKanban,
    children: [
      { href: "/projects", label: "All Projects" },
      { href: "/tasks", label: "Tasks" }
    ]
  },
  {
    label: "People",
    icon: UserCircle,
    children: [
      { href: "/employees", label: "Employees" },
      { href: "/attendance", label: "Attendance" }
    ]
  },
  {
    label: "Finance",
    icon: DollarSign,
    children: [
      { href: "/finance/expenses", label: "Expenses" },
      { href: "/finance/invoices", label: "Invoices" },
      { href: "/finance/payments", label: "Payments" }
    ]
  },
  { href: "/documents", label: "Documents", icon: FolderOpen },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/profile", label: "Profile", icon: UserCircle },
  { href: "/settings", label: "Settings", icon: Settings }
];

const flatLinks = navItems.flatMap((item) =>
  item.children ? item.children : item.href ? [{ href: item.href, label: item.label }] : []
);

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { collapsed, mobileOpen, toggleCollapsed, setMobileOpen } = useShell();
  const [navQuery, setNavQuery] = useState("");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    CRM: true,
    Projects: true,
    Finance: true,
    People: false
  });

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const filtered = useMemo(() => {
    if (!navQuery.trim()) return null;
    const q = navQuery.toLowerCase();
    return flatLinks.filter((l) => l.label.toLowerCase().includes(q));
  }, [navQuery]);

  const sidebarWidth = collapsed ? 72 : 260;

  const navItemClass = (active: boolean, collapsedView = false) =>
    cn(
      "flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-all duration-200",
      active
        ? "bg-[#EFF6FF] text-[#2563EB]"
        : "text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]",
      collapsedView && "justify-center px-2"
    );

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <motion.aside
        initial={false}
        animate={{ width: sidebarWidth }}
        transition={{ type: "spring", stiffness: 280, damping: 30 }}
        className={cn(
          "fixed z-50 flex flex-col border-r border-[#E2E8F0] bg-white",
          "inset-y-0 left-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className={cn("flex h-14 items-center border-b border-[#E2E8F0] px-4", collapsed && "justify-center px-0")}>
          {collapsed ? <LexcoreLogo size="sm" /> : <LexcoreLogo showWordmark />}
        </div>

        {!collapsed && (
          <div className="px-3 pt-3 pb-1">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[#94A3B8]" />
              <Input
                value={navQuery}
                onChange={(e) => setNavQuery(e.target.value)}
                placeholder="Search menu..."
                className="h-9 rounded-[8px] bg-[#F8FAFC] pl-8 text-xs"
              />
            </div>
          </div>
        )}

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
          {filtered ? (
            filtered.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={navItemClass(isActive(link.href))}
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
                  <div key={item.label}>
                    <button
                      type="button"
                      onClick={() =>
                        collapsed
                          ? router.push(item.children![0].href)
                          : setOpenGroups((p) => ({ ...p, [item.label]: !groupOpen }))
                      }
                      className={navItemClass(childActive, collapsed)}
                    >
                      <Icon className="size-[18px] shrink-0" />
                      {!collapsed && (
                        <>
                          <span className="flex-1 text-left">{item.label}</span>
                          <ChevronDown className={cn("size-3.5 text-[#94A3B8] transition duration-200", groupOpen && "rotate-180")} />
                        </>
                      )}
                    </button>
                    <AnimatePresence initial={false}>
                      {!collapsed && groupOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          {item.children.map((child) => (
                            <Link
                              key={child.href}
                              href={child.href}
                              onClick={() => setMobileOpen(false)}
                              className={cn(
                                "flex items-center gap-3 rounded-[8px] px-3 py-2 text-sm transition ml-7",
                                isActive(child.href)
                                  ? "bg-[#EFF6FF] text-[#2563EB] font-medium"
                                  : "text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
                              )}
                            >
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
                  className={navItemClass(isActive(item.href!), collapsed)}
                >
                  <Icon className="size-[18px] shrink-0" />
                  {!collapsed && (
                    <span>{item.label}</span>
                  )}
                </Link>
              );
            })
          )}
        </nav>

        <div className="border-t border-[#E2E8F0] p-3">
          <div
            className={cn(
              "flex items-center gap-3 rounded-[10px] bg-[#F8FAFC] p-2",
              collapsed && "justify-center"
            )}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[#2563EB] text-sm font-bold text-white">
              {user?.fullName?.charAt(0) ?? "A"}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[#0F172A]">{user?.fullName ?? "Admin"}</p>
                <p className="truncate text-[11px] text-[#64748B]">{user?.email}</p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => void logout()}
            className={cn(
              "flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm text-[#64748B] transition hover:bg-red-50 hover:text-red-500 mt-1",
              collapsed && "justify-center px-2"
            )}
          >
            <LogOut className="size-[18px]" />
            {!collapsed && <span>Logout</span>}
          </button>

          <button
            type="button"
            onClick={toggleCollapsed}
            className="hidden w-full items-center justify-center rounded-[10px] border border-[#E2E8F0] p-2 text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#0F172A] mt-1 lg:flex"
          >
            {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          </button>
        </div>
      </motion.aside>
    </>
  );
}

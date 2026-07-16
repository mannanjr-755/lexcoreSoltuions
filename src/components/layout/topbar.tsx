"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Menu,
  Search,
  User,
  LogOut,
  Plus,
  MessageSquare,
  ChevronRight,
  Users,
  FolderKanban,
  Receipt,
  ListTodo
} from "lucide-react";
import api from "@/lib/axios";
import { useAuth } from "@/components/providers/auth-provider";
import { useShell } from "@/components/providers/shell-provider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SearchResults {
  customers: Array<{ _id: string; name: string; type: string }>;
  projects: Array<{ _id: string; name: string; type: string }>;
  employees: Array<{ _id: string; fullName: string; type: string }>;
  payments: Array<{ _id: string; invoiceNumber: string; type: string }>;
  expenses: Array<{ _id: string; title: string; type: string }>;
}

const crumbMap: Record<string, string> = {
  dashboard: "Dashboard",
  crm: "CRM",
  customers: "Customers",
  projects: "Projects",
  employees: "Employees",
  tasks: "Tasks",
  quotations: "Quotations",
  finance: "Finance",
  expenses: "Expenses",
  invoices: "Invoices",
  payments: "Payments",
  attendance: "Attendance",
  payroll: "Payroll",
  departments: "Departments",
  documents: "Documents",
  reports: "Reports",
  notifications: "Notifications",
  profile: "Profile",
  settings: "Settings"
};

export function Topbar({
  unreadCount,
  setUnreadCount
}: {
  unreadCount: number;
  setUnreadCount: (count: number) => void;
}) {
  const { user, logout } = useAuth();
  const { toggleMobile } = useShell();
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [notifications, setNotifications] = useState<
    Array<{ _id: string; title: string; message: string; isRead: boolean }>
  >([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [now, setNow] = useState(new Date());
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    api
      .get("/api/notifications")
      .then((res) => {
        setNotifications(res.data.notifications ?? []);
        setUnreadCount(res.data.unreadCount ?? 0);
      })
      .catch(() => {});
  }, [setUnreadCount]);

  useEffect(() => {
    if (query.length < 2) {
      setResults(null);
      return;
    }
    const timer = setTimeout(() => {
      api
        .get(`/api/search?q=${encodeURIComponent(query)}`)
        .then((res) => {
          setResults(res.data.results);
          setShowSearch(true);
        })
        .catch(() => {});
    }, 280);
    return () => clearTimeout(timer);
  }, [query]);

  const crumbs = useMemo(
    () =>
      pathname
        .split("/")
        .filter(Boolean)
        .map((segment) => crumbMap[segment] ?? segment),
    [pathname]
  );

  const allResults = results
    ? [...results.customers, ...results.projects, ...results.employees, ...results.payments, ...results.expenses]
    : [];

  const markAllRead = async () => {
    await api.patch("/api/notifications", { markAllRead: true });
    setUnreadCount(0);
    setNotifications((n) => n.map((item) => ({ ...item, isRead: true })));
  };

  const dateLabel = now.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  });
  const timeLabel = now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

  const createItems = [
    { label: "Customer", href: "/crm/customers", icon: Users },
    { label: "Project", href: "/projects", icon: FolderKanban },
    { label: "Invoice", href: "/finance/invoices", icon: Receipt },
    { label: "Task", href: "/tasks", icon: ListTodo }
  ];

  return (
    <header className="sticky top-0 z-30 mx-3 mt-3 rounded-[20px] border border-[#E2E8F0] bg-white/95 px-3 py-2.5 shadow-sm backdrop-blur-xl md:mx-4 md:px-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={toggleMobile}>
            <Menu className="size-5" />
          </Button>

          <div className="hidden min-w-0 md:block">
            <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
              <span className="font-semibold text-[#C9A227]">Lexcore</span>
              {crumbs.map((c) => (
                <span key={c} className="flex items-center gap-1.5">
                  <ChevronRight className="size-3 opacity-50" />
                  <span className="truncate text-[#0F172A]">{c}</span>
                </span>
              ))}
            </div>
            <p className="mt-0.5 font-mono-num text-[11px] text-[#94A3B8]">
              {dateLabel} · {timeLabel}
            </p>
          </div>

          <div ref={searchRef} className="relative w-full max-w-xl">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#94A3B8]" />
            <Input
              placeholder="Search customers, projects, invoices..."
              className="h-11 rounded-[12px] bg-[#F8FAFC] pl-10"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => query.length >= 2 && setShowSearch(true)}
              onBlur={() => setTimeout(() => setShowSearch(false), 180)}
            />
            {showSearch && allResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-50 mt-2 rounded-[16px] border border-[#E2E8F0] bg-white p-2 shadow-xl">
                {allResults.map((item) => (
                  <button
                    key={item._id}
                    type="button"
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-[#F1F5F9]"
                    onClick={() => {
                      setQuery("");
                      setShowSearch(false);
                      if (item.type === "customer") router.push("/crm/customers");
                      if (item.type === "project") router.push("/projects");
                      if (item.type === "employee") router.push("/employees");
                      if (item.type === "expense") router.push("/finance/expenses");
                      if (item.type === "payment") router.push("/finance/invoices");
                    }}
                  >
                    <span className="rounded-md bg-[rgba(212,175,55,0.12)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[#C9A227]">
                      {item.type}
                    </span>
                    <span className="truncate text-[#0F172A]">
                      {"name" in item
                        ? item.name
                        : "fullName" in item
                          ? item.fullName
                          : "invoiceNumber" in item
                            ? item.invoiceNumber
                            : "title" in item
                              ? item.title
                              : ""}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="relative">
            <Button variant="secondary" size="sm" className="hidden sm:inline-flex" onClick={() => setShowCreate((v) => !v)}>
              <Plus className="size-4" /> Create
            </Button>
            {showCreate && (
              <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-[16px] border border-[#E2E8F0] bg-white p-2 shadow-xl">
                {createItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.href}
                      type="button"
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-[#0F172A] hover:bg-[#F1F5F9]"
                      onClick={() => {
                        setShowCreate(false);
                        router.push(item.href);
                      }}
                    >
                      <Icon className="size-4 text-[#C9A227]" /> {item.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <Button variant="ghost" size="icon" onClick={() => router.push("/notifications")} title="Messages">
            <MessageSquare className="size-4" />
          </Button>

          <div className="relative">
            <Button variant="ghost" size="icon" onClick={() => setShowNotifs((v) => !v)}>
              <Bell className="size-4" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#D4AF37] px-1 text-[10px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </Button>
            {showNotifs && (
              <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-[16px] border border-[#E2E8F0] bg-white p-3 shadow-xl">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#0F172A]">Notifications</span>
                  <button type="button" onClick={markAllRead} className="text-xs text-[#C9A227] hover:text-[#D4AF37]">
                    Mark all read
                  </button>
                </div>
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="py-6 text-center text-sm text-[#64748B]">No notifications</p>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n._id}
                        className={cn("rounded-xl p-2.5 text-sm", !n.isRead && "bg-[rgba(212,175,55,0.08)]")}
                      >
                        <p className="font-medium text-[#0F172A]">{n.title}</p>
                        <p className="text-xs text-[#64748B]">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowProfile((v) => !v)}
              className="flex items-center gap-2 rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-1.5 hover:bg-[#F1F5F9]"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#08142D] to-[#1E3A8A] text-sm font-bold text-[#E6C86E]">
                {user?.fullName?.charAt(0) ?? "A"}
              </div>
              <span className="hidden max-w-[120px] truncate text-sm font-medium text-[#0F172A] md:block">
                {user?.fullName ?? "Admin"}
              </span>
            </button>
            {showProfile && (
              <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-[16px] border border-[#E2E8F0] bg-white p-2 shadow-xl">
                <button
                  type="button"
                  onClick={() => router.push("/profile")}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-[#0F172A] hover:bg-[#F1F5F9]"
                >
                  <User className="size-4" /> Profile
                </button>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-red-500 hover:bg-red-50"
                >
                  <LogOut className="size-4" /> Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

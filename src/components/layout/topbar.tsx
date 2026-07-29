"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Menu,
  Search,
  User,
  LogOut,
  Plus,
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
  documents: "Documents",
  reports: "Reports",
  profile: "Profile",
  settings: "Settings"
};

export function Topbar() {
  const { user, logout } = useAuth();
  const { toggleMobile } = useShell();
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

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

  const createItems = [
    { label: "Customer", href: "/crm/customers", icon: Users },
    { label: "Project", href: "/projects", icon: FolderKanban },
    { label: "Invoice", href: "/finance/invoices", icon: Receipt },
    { label: "Task", href: "/tasks", icon: ListTodo }
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-[#E2E8F0] bg-white/80 backdrop-blur-xl">
      <div className="flex h-14 items-center justify-between gap-3 px-4 lg:px-6">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Button variant="ghost" size="icon" className="lg:hidden shrink-0" onClick={toggleMobile}>
            <Menu className="size-5" />
          </Button>

          <div className="hidden min-w-0 md:flex items-center gap-1.5 text-xs text-[#64748B]">
            {crumbs.map((c, i) => (
              <span key={c} className="flex items-center gap-1.5">
                {i > 0 && <ChevronRight className="size-3 text-[#94A3B8]" />}
                <span className={cn("truncate", i === crumbs.length - 1 ? "font-medium text-[#0F172A]" : "")}>
                  {c}
                </span>
              </span>
            ))}
          </div>
        </div>

        <div className="hidden sm:flex items-center flex-1 max-w-md mx-auto">
          <div ref={searchRef} className="relative w-full">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#94A3B8]" />
            <Input
              placeholder="Search..."
              className="h-9 rounded-[8px] bg-[#F8FAFC] pl-9 text-sm"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => query.length >= 2 && setShowSearch(true)}
              onBlur={() => setTimeout(() => setShowSearch(false), 180)}
            />
            {showSearch && allResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-50 mt-2 rounded-[12px] border border-[#E2E8F0] bg-white p-2 premium-shadow-lg">
                {allResults.map((item) => (
                  <button
                    key={item._id}
                    type="button"
                    className="flex w-full items-center gap-2 rounded-[8px] px-3 py-2 text-left text-sm hover:bg-[#F1F5F9]"
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
                    <span className="rounded-md bg-[#EFF6FF] px-2 py-0.5 text-[10px] font-medium text-[#2563EB]">
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

        <div className="flex items-center gap-1.5">
          <div className="relative">
            <Button variant="ghost" size="icon" onClick={() => setShowCreate((v) => !v)}>
              <Plus className="size-[18px]" />
            </Button>
            {showCreate && (
              <div className="absolute right-0 top-full z-50 mt-2 w-44 rounded-[12px] border border-[#E2E8F0] bg-white p-1.5 premium-shadow-lg">
                {createItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.href}
                      type="button"
                      className="flex w-full items-center gap-2 rounded-[8px] px-3 py-2 text-sm text-[#0F172A] hover:bg-[#F1F5F9]"
                      onClick={() => {
                        setShowCreate(false);
                        router.push(item.href);
                      }}
                    >
                      <Icon className="size-4 text-[#64748B]" /> {item.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowProfile((v) => !v)}
              className="flex items-center gap-2 rounded-[8px] p-1 hover:bg-[#F1F5F9] transition"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[#2563EB] text-sm font-bold text-white">
                {user?.fullName?.charAt(0) ?? "A"}
              </div>
            </button>
            {showProfile && (
              <div className="absolute right-0 top-full z-50 mt-2 w-44 rounded-[12px] border border-[#E2E8F0] bg-white p-1.5 premium-shadow-lg">
                <div className="px-3 py-2 border-b border-[#E2E8F0] mb-1">
                  <p className="text-sm font-medium text-[#0F172A]">{user?.fullName ?? "Admin"}</p>
                  <p className="text-xs text-[#64748B] truncate">{user?.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowProfile(false);
                    router.push("/profile");
                  }}
                  className="flex w-full items-center gap-2 rounded-[8px] px-3 py-2 text-sm text-[#0F172A] hover:bg-[#F1F5F9]"
                >
                  <User className="size-4" /> Profile
                </button>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="flex w-full items-center gap-2 rounded-[8px] px-3 py-2 text-sm text-red-500 hover:bg-red-50"
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

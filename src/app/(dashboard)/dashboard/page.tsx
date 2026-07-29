"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Users,
  FolderKanban,
  DollarSign,
  TrendingUp,
  Wallet,
  UserCheck,
  Clock,
  Plus,
  Receipt,
  CalendarDays,
  Activity,
  Briefcase,
  ArrowRight,
  ListTodo,
  FileSpreadsheet,
  Target,
  ChevronLeft,
  ChevronRight,
  CheckCircle
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from "recharts";
import api from "@/lib/axios";
import { formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PremiumStatCard, StatCardSkeleton } from "@/components/dashboard/premium-stat-card";
import { useAuth } from "@/components/providers/auth-provider";

interface DashboardData {
  customers: { total: number; revenue: number; received: number; pending: number };
  projects: {
    total: number;
    active: number;
    completed: number;
    pending: number;
    cancelled: number;
    running: number;
    avgProgress: number;
    completionPct: number;
  };
  employees: { total: number; active: number; managers: number; attendancePct: number };
  attendance?: {
    total: number;
    present: number;
    absent: number;
    late: number;
    halfDay: number;
    leave: number;
    workFromHome: number;
    percentage: number;
  };
  financials: {
    totalRevenue: number;
    totalExpenses: number;
    totalProfit: number;
    pendingPayments: number;
    monthlyRevenue: number;
    monthlyExpenses: number;
    monthlyProfit: number;
    invoices: number;
  };
  growth: { revenue: number; expenses: number; profit: number };
  tasks: { today: number };
  chartData: Array<{ month: string; revenue: number; expenses: number; profit: number }>;
  sparks: { revenue: number[]; expenses: number[]; profit: number[] };
  upcomingDeadlines: Array<{
    _id: string;
    name: string;
    deadline: string;
    progress: number;
    status: string;
  }>;
  latestPayments: Array<{
    _id: string;
    invoiceNumber: string;
    grandTotal: number;
    status: string;
    createdAt: string;
  }>;
  latestCustomers: Array<{
    _id: string;
    name: string;
    phone?: string;
    status: string;
    createdAt: string;
    totalCost: number;
  }>;
  latestProjects: Array<{
    _id: string;
    name: string;
    status: string;
    progress: number;
    deadline: string;
  }>;
  monthlyGrowth: number;
}

const PIE_COLORS = ["#2563EB", "#22C55E", "#F59E0B", "#EF4444", "#8B5CF6"];

const tooltipStyle = {
  background: "#FFFFFF",
  border: "1px solid #E2E8F0",
  borderRadius: 12,
  fontSize: 12,
  color: "#0F172A",
  boxShadow: "0 4px 16px rgba(0,0,0,0.08)"
};

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["dashboard-stats"],
    queryFn: async () => (await api.get("/api/dashboard/stats")).data,
    refetchInterval: 60_000
  });

  const [monthOffset, setMonthOffset] = useState(0);
  const today = useMemo(() => new Date(), []);

  const calendarDays = useMemo(() => {
    const base = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
    const year = base.getFullYear();
    const month = base.getMonth();
    const first = base.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ day: number | null; isToday?: boolean }> = [];
    for (let i = 0; i < first; i++) cells.push({ day: null });
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        day: d,
        isToday: monthOffset === 0 && d === today.getDate()
      });
    }
    return cells;
  }, [monthOffset, today]);

  const calendarLabel = useMemo(() => {
    const d = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
    return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }, [monthOffset, today]);

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-[#F1F5F9]" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-[16px] border border-red-200 bg-red-50 p-6 text-sm text-red-600">
        Unable to load dashboard data. Please refresh.
      </div>
    );
  }

  const stats = {
    ...data,
    upcomingDeadlines: Array.isArray(data.upcomingDeadlines) ? data.upcomingDeadlines : [],
    latestPayments: Array.isArray(data.latestPayments) ? data.latestPayments : [],
    latestCustomers: Array.isArray(data.latestCustomers) ? data.latestCustomers : [],
    latestProjects: Array.isArray(data.latestProjects) ? data.latestProjects : [],
    chartData: Array.isArray(data.chartData) ? data.chartData : [],
    sparks: data.sparks ?? { revenue: [], expenses: [], profit: [] },
    growth: data.growth ?? { revenue: 0, expenses: 0, profit: 0 },
    tasks: data.tasks ?? { today: 0 },
    employees: data.employees ?? { total: 0, active: 0, managers: 0, attendancePct: 0 },
    attendance: data.attendance ?? {
      total: 0,
      present: 0,
      absent: 0,
      late: 0,
      halfDay: 0,
      leave: 0,
      workFromHome: 0,
      percentage: data.employees?.attendancePct ?? 0
    }
  };

  const projectPie = [
    { name: "Active", value: stats.projects.active },
    { name: "Completed", value: stats.projects.completed },
    { name: "Pending", value: stats.projects.pending },
    { name: "Cancelled", value: stats.projects.cancelled }
  ].filter((p) => p.value > 0);

  const shortcuts = [
    { label: "Add Customer", href: "/crm/customers", icon: Users },
    { label: "New Project", href: "/projects", icon: FolderKanban },
    { label: "Create Invoice", href: "/finance/invoices", icon: Receipt },
    { label: "Log Expense", href: "/finance/expenses", icon: Wallet },
    { label: "Add Task", href: "/tasks", icon: ListTodo },
    { label: "Attendance", href: "/attendance", icon: CalendarDays },
    { label: "View Reports", href: "/reports", icon: FileSpreadsheet }
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#0F172A]">Now</h1>
          <p className="text-sm text-[#64748B]">Dashboard overview for {user?.fullName?.split(" ")[0] ?? "Admin"}</p>
        </div>
        <Button size="sm" onClick={() => router.push("/crm/customers")}>
          <Plus className="size-4" /> Quick Create
        </Button>
      </div>

      {/* Premium KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <PremiumStatCard label="Total Revenue" description="All-time revenue" value={stats.financials.totalRevenue} icon={DollarSign} growth={stats.growth.revenue} spark={stats.sparks.revenue} href="/finance/invoices" format="currency" tone={0} delay={0} />
        <PremiumStatCard label="Active Projects" description="Currently in delivery" value={stats.projects.active} icon={FolderKanban} href="/projects" tone={1} delay={0.05} />
        <PremiumStatCard label="Total Customers" description="CRM accounts" value={stats.customers.total} icon={Users} href="/crm/customers" tone={2} delay={0.1} />
        <PremiumStatCard label="Net Profit" description="Revenue minus expenses" value={stats.financials.totalProfit} icon={TrendingUp} growth={stats.growth.profit} spark={stats.sparks.profit} href="/reports" format="currency" tone={3} delay={0.15} />
      </div>

      {/* Secondary KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <PremiumStatCard label="Monthly Revenue" description="This month" value={stats.financials.monthlyRevenue} icon={Activity} spark={stats.sparks.revenue} format="currency" tone={0} delay={0} />
        <PremiumStatCard label="Monthly Expenses" description="This month spend" value={stats.financials.monthlyExpenses} icon={Wallet} growth={stats.growth.expenses} spark={stats.sparks.expenses} format="currency" tone={4} delay={0.05} />
        <PremiumStatCard label="Active Employees" description="Workforce" value={stats.employees.active} icon={UserCheck} href="/employees" tone={5} delay={0.1} />
        <PremiumStatCard label="Pending Payments" description="Outstanding" value={stats.financials.pendingPayments} icon={Clock} href="/finance/invoices" format="currency" tone={3} delay={0.15} />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-[#64748B] uppercase tracking-wider mb-3">Quick Actions</h2>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
          {shortcuts.map((s, i) => {
            const Icon = s.icon;
            return (
              <motion.button
                key={s.href}
                type="button"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.03 * i }}
                onClick={() => router.push(s.href)}
                className="flex items-center gap-3 rounded-[10px] border border-[#E2E8F0] bg-white px-3.5 py-2.5 text-left text-sm font-medium text-[#0F172A] premium-shadow transition-all duration-200 hover:border-[#2563EB]/30 hover:bg-[#EFF6FF] hover:text-[#2563EB] active:scale-[0.98]"
              >
                <div className="rounded-[8px] bg-[#F1F5F9] p-1.5 text-[#64748B] transition group-hover:bg-[#EFF6FF]">
                  <Icon className="size-4" />
                </div>
                {s.label}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Revenue Trend</CardTitle>
              <p className="mt-0.5 text-xs text-[#64748B]">6-month overview</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => router.push("/reports")}>
              Details <ArrowRight className="size-3.5" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.chartData}>
                  <defs>
                    <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="profFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22C55E" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="month" stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="revenue" stroke="#2563EB" fill="url(#revFill)" strokeWidth={2.5} />
                  <Area type="monotone" dataKey="expenses" stroke="#EF4444" fill="url(#expFill)" strokeWidth={2} />
                  <Area type="monotone" dataKey="profit" stroke="#22C55E" fill="url(#profFill)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Project Status</CardTitle>
            <p className="mt-0.5 text-xs text-[#64748B]">Distribution by status</p>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={projectPie.length ? projectPie : [{ name: "None", value: 1 }]}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {(projectPie.length ? projectPie : [{ name: "None", value: 1 }]).map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 w-full">
              {projectPie.map((p, i) => (
                <div key={p.name} className="flex items-center gap-2 text-xs text-[#64748B]">
                  <span className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="flex-1">{p.name}</span>
                  <span className="font-medium text-[#0F172A]">{p.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Expense vs Profit Bar */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Expenses & Profit</CardTitle>
            <p className="mt-0.5 text-xs text-[#64748B]">Monthly breakdown</p>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="month" stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="expenses" fill="#EF4444" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="profit" fill="#22C55E" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attendance Overview</CardTitle>
            <p className="mt-0.5 text-xs text-[#64748B]">Today&rsquo;s status</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[10px] border border-[#E2E8F0] p-3">
                <p className="text-xs text-[#64748B]">Present</p>
                <p className="text-xl font-bold text-[#22C55E]">{stats.attendance.present}</p>
              </div>
              <div className="rounded-[10px] border border-[#E2E8F0] p-3">
                <p className="text-xs text-[#64748B]">Absent</p>
                <p className="text-xl font-bold text-[#EF4444]">{stats.attendance.absent}</p>
              </div>
              <div className="rounded-[10px] border border-[#E2E8F0] p-3">
                <p className="text-xs text-[#64748B]">Late</p>
                <p className="text-xl font-bold text-[#F59E0B]">{stats.attendance.late}</p>
              </div>
              <div className="rounded-[10px] border border-[#E2E8F0] p-3">
                <p className="text-xs text-[#64748B]">Leave</p>
                <p className="text-xl font-bold text-[#2563EB]">{stats.attendance.leave}</p>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-[10px] bg-[#F8FAFC] px-4 py-3">
              <span className="text-sm text-[#64748B]">Attendance Rate</span>
              <span className="text-lg font-bold text-[#0F172A]">{stats.attendance.percentage}%</span>
            </div>
            <Button variant="secondary" className="w-full" size="sm" onClick={() => router.push("/attendance")}>
              View Full Attendance
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Lists — Calendar, Deadlines, Quick Stats */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {/* Calendar */}
        <Card className="group/card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <CalendarDays className="size-4 text-[#64748B]" /> Calendar
            </CardTitle>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setMonthOffset((p) => p - 1)}
                className="flex h-7 w-7 items-center justify-center rounded-[6px] text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#0F172A]"
              >
                <ChevronLeft className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setMonthOffset((p) => p + 1)}
                className="flex h-7 w-7 items-center justify-center rounded-[6px] text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#0F172A]"
              >
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm font-semibold text-[#0F172A]">{calendarLabel}</p>
            <div className="grid grid-cols-7 gap-0.5 text-center text-xs text-[#94A3B8]">
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <span key={`${d}-${i}`} className="py-1 text-[11px] font-medium">{d}</span>
              ))}
            </div>
            <div className="mt-0.5 grid grid-cols-7 gap-0.5">
              {calendarDays.map((c, i) => (
                <div
                  key={i}
                  className={`flex h-8 items-center justify-center rounded-[8px] text-xs font-medium transition-all duration-150 ${
                    c.isToday
                      ? "bg-[#2563EB] text-white shadow-sm"
                      : c.day
                        ? "text-[#0F172A] hover:bg-[#F1F5F9] cursor-default"
                        : ""
                  }`}
                >
                  {c.day ?? ""}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => router.push("/tasks")}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-[10px] border border-dashed border-[#E2E8F0] px-3 py-2.5 text-sm font-medium text-[#64748B] transition-all duration-200 hover:border-[#2563EB]/40 hover:bg-[#EFF6FF] hover:text-[#2563EB]"
            >
              <Plus className="size-3.5" /> Add Task
            </button>
          </CardContent>
        </Card>

        {/* Deadlines */}
        <Card className="group/card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <Target className="size-4 text-[#64748B]" /> Deadlines
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.upcomingDeadlines.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#F0FDF4]">
                  <CheckCircle className="size-7 text-[#22C55E]" />
                </div>
                <p className="text-base font-semibold text-[#0F172A]">No upcoming deadlines</p>
                <p className="mt-1 text-sm text-[#64748B]">
                  You&rsquo;re all caught up. New deadlines will appear here.
                </p>
                <button
                  type="button"
                  onClick={() => router.push("/tasks")}
                  className="mt-5 flex items-center gap-2 rounded-[10px] bg-[#2563EB] px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-[#1D4ED8] active:scale-[0.97]"
                >
                  <Plus className="size-3.5" /> Create Task
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {stats.upcomingDeadlines.map((d, idx) => (
                  <div key={d._id} className="relative pl-5">
                    {idx < stats.upcomingDeadlines.length - 1 && (
                      <div className="absolute left-[7px] top-4 bottom-0 w-px bg-[#E2E8F0]" />
                    )}
                    <div className="absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-[#2563EB] bg-white" />
                    <button
                      type="button"
                      onClick={() => router.push("/projects")}
                      className="w-full rounded-[10px] border border-[#E2E8F0] bg-white p-3 text-left transition hover:bg-[#F8FAFC] hover:shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-[#0F172A]">{d.name}</p>
                        <span className="shrink-0 rounded-full bg-[#EFF6FF] px-2 py-0.5 text-[11px] font-semibold text-[#2563EB]">
                          {d.progress}%
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[#64748B]">{formatDate(d.deadline)}</p>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card className="group/card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <Briefcase className="size-4 text-[#64748B]" /> Quick Stats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[12px] border border-[#E2E8F0] bg-white p-4 transition-all duration-200 hover:border-[#2563EB]/20 hover:bg-[#F8FAFC] hover:shadow-sm">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#EFF6FF]">
                  <Receipt className="size-[18px] text-[#2563EB]" />
                </div>
                <p className="text-2xl font-bold text-[#0F172A]">{stats.financials.invoices}</p>
                <p className="mt-0.5 text-sm text-[#64748B]">Invoices</p>
              </div>
              <div className="rounded-[12px] border border-[#E2E8F0] bg-white p-4 transition-all duration-200 hover:border-[#2563EB]/20 hover:bg-[#F8FAFC] hover:shadow-sm">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#F0FDF4]">
                  <UserCheck className="size-[18px] text-[#22C55E]" />
                </div>
                <p className="text-2xl font-bold text-[#0F172A]">{stats.employees.managers}</p>
                <p className="mt-0.5 text-sm text-[#64748B]">Managers</p>
              </div>
              <div className="rounded-[12px] border border-[#E2E8F0] bg-white p-4 transition-all duration-200 hover:border-[#2563EB]/20 hover:bg-[#F8FAFC] hover:shadow-sm">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#FFF7ED]">
                  <ListTodo className="size-[18px] text-[#F59E0B]" />
                </div>
                <p className="text-2xl font-bold text-[#0F172A]">{stats.tasks.today}</p>
                <p className="mt-0.5 text-sm text-[#64748B]">Tasks Today</p>
              </div>
              <div className="rounded-[12px] border border-[#E2E8F0] bg-white p-4 transition-all duration-200 hover:border-[#2563EB]/20 hover:bg-[#F8FAFC] hover:shadow-sm">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#F8FAFC]">
                  <Users className="size-[18px] text-[#64748B]" />
                </div>
                <p className="text-2xl font-bold text-[#0F172A]">{stats.customers.total}</p>
                <p className="mt-0.5 text-sm text-[#64748B]">Customers</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Customers & Projects */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Latest Customers</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => router.push("/crm/customers")}>
              View all
            </Button>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {stats.latestCustomers.map((c) => (
              <button
                key={c._id}
                type="button"
                onClick={() => router.push("/crm/customers")}
                className="flex w-full items-center justify-between rounded-[8px] border border-[#E2E8F0] bg-white p-2.5 text-left transition hover:bg-[#F8FAFC]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[#EFF6FF] text-sm font-bold text-[#2563EB]">
                    {c.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#0F172A]">{c.name}</p>
                    <p className="text-xs text-[#64748B]">{c.phone || "No phone"}</p>
                  </div>
                </div>
                <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[10px] font-medium capitalize text-[#64748B]">
                  {c.status}
                </span>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Projects</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => router.push("/projects")}>
              View all
            </Button>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {stats.latestProjects.map((p) => (
              <button
                key={p._id}
                type="button"
                onClick={() => router.push("/projects")}
                className="w-full rounded-[8px] border border-[#E2E8F0] bg-white p-2.5 text-left transition hover:bg-[#F8FAFC]"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-[#0F172A]">{p.name}</p>
                  <span className="text-xs font-medium text-[#2563EB]">{p.progress}%</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#F1F5F9]">
                  <div
                    className="h-full rounded-full bg-[#2563EB]"
                    style={{ width: `${Math.min(100, Number(p.progress) || 0)}%` }}
                  />
                </div>
                <p className="mt-1.5 text-xs capitalize text-[#64748B]">
                  {p.status} &middot; due {formatDate(p.deadline)}
                </p>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}

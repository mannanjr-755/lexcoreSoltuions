"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Users,
  FolderKanban,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wallet,
  UserCheck,
  Bell,
  Clock,
  Plus,
  Receipt,
  CalendarDays,
  Percent,
  Activity,
  Briefcase,
  CheckCircle2,
  PlayCircle,
  ArrowRight,
  Sparkles,
  ListTodo,
  FileSpreadsheet
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
  Cell,
  RadialBarChart,
  RadialBar
} from "recharts";
import api from "@/lib/axios";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
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
  notifications: {
    unread: number;
    items: Array<{ _id: string; title: string; message: string; createdAt: string }>;
  };
  chartData: Array<{ month: string; revenue: number; expenses: number; profit: number }>;
  sparks: { revenue: number[]; expenses: number[]; profit: number[] };
  recentActivities: Array<{
    _id: string;
    action: string;
    description: string;
    userName: string;
    createdAt: string;
  }>;
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
    company?: string;
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

const PIE_COLORS = ["#D4AF37", "#1E3A8A", "#22C55E", "#F59E0B", "#102348"];

const tooltipStyle = {
  background: "#FFFFFF",
  border: "1px solid #E2E8F0",
  borderRadius: 14,
  fontSize: 12,
  color: "#0F172A"
};

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["dashboard-stats"],
    queryFn: async () => (await api.get("/api/dashboard/stats")).data,
    refetchInterval: 60_000
  });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const calendarDays = useMemo(() => {
    const base = new Date();
    const year = base.getFullYear();
    const month = base.getMonth();
    const first = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ day: number | null; today?: boolean }> = [];
    for (let i = 0; i < first; i++) cells.push({ day: null });
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, today: d === base.getDate() });
    }
    return cells;
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-40 animate-pulse rounded-[28px] bg-[#F1F5F9]" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-[22px] border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-300">
        Unable to load live dashboard data from MongoDB. Please refresh.
      </div>
    );
  }

  const stats = {
    ...data,
    recentActivities: Array.isArray(data.recentActivities) ? data.recentActivities : [],
    upcomingDeadlines: Array.isArray(data.upcomingDeadlines) ? data.upcomingDeadlines : [],
    latestPayments: Array.isArray(data.latestPayments) ? data.latestPayments : [],
    latestCustomers: Array.isArray(data.latestCustomers) ? data.latestCustomers : [],
    latestProjects: Array.isArray(data.latestProjects) ? data.latestProjects : [],
    chartData: Array.isArray(data.chartData) ? data.chartData : [],
    sparks: data.sparks ?? { revenue: [], expenses: [], profit: [] },
    notifications: data.notifications ?? { unread: 0, items: [] },
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

  const radialData = [
    { name: "Completion", value: stats.projects.completionPct, fill: "#D4AF37" },
    { name: "Attendance", value: stats.attendance.percentage || stats.employees.attendancePct, fill: "#22C55E" }
  ];

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
    <div className="space-y-6">
      {/* Welcome */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="lexcore-banner relative overflow-hidden rounded-[28px] border border-[#102348] p-6 text-white md:p-8"
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#D4AF37]/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-40 w-40 rounded-full bg-white/5 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-3 py-1 text-xs font-medium text-[#E6C86E]">
              <Sparkles className="size-3.5" /> Lexcore Solutions · Executive Intelligence
            </div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-white md:text-4xl">
              {greeting}, {user?.fullName?.split(" ")[0] ?? "Admin"}
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-300 md:text-base">
              Premium overview for Lexcore — revenue, delivery, people, and pipeline synced live from MongoDB.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Revenue", value: formatCurrency(stats.financials.totalRevenue) },
              { label: "Profit", value: formatCurrency(stats.financials.totalProfit) },
              { label: "Projects", value: String(stats.projects.total) },
              { label: "Customers", value: String(stats.customers.total) }
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{item.label}</p>
                <p className="mt-1 font-mono-num text-sm font-semibold text-[#E6C86E] md:text-base">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* Quick actions */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
        {shortcuts.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.button
              key={s.href}
              type="button"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i }}
              onClick={() => router.push(s.href)}
              className="group flex items-center gap-3 rounded-[16px] border border-[#E2E8F0] bg-white px-4 py-3 text-left shadow-sm transition hover:-translate-y-1 hover:border-[#D4AF37]/40 hover:bg-[rgba(212,175,55,0.06)]"
            >
              <div className="rounded-xl bg-[rgba(212,175,55,0.12)] p-2 text-[#C9A227] transition group-hover:scale-110">
                <Icon className="size-4" />
              </div>
              <span className="text-sm font-semibold">{s.label}</span>
            </motion.button>
          );
        })}
      </section>

      {/* KPI cards */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <PremiumStatCard label="Active Projects" description="Currently in delivery" value={stats.projects.active} icon={PlayCircle} growth={stats.growth.revenue} spark={stats.sparks.revenue} href="/projects" tone="gold" delay={0} />
        <PremiumStatCard label="Total Revenue" description="Collected payments" value={stats.financials.totalRevenue} icon={DollarSign} growth={stats.growth.revenue} spark={stats.sparks.revenue} href="/finance/invoices" format="currency" tone="gold" delay={0.04} />
        <PremiumStatCard label="Total Profit" description="Revenue minus expenses" value={stats.financials.totalProfit} icon={TrendingUp} growth={stats.growth.profit} spark={stats.sparks.profit} href="/reports" format="currency" tone="green" delay={0.08} />
        <PremiumStatCard label="Pending Payments" description="Outstanding balances" value={stats.financials.pendingPayments} icon={Wallet} href="/finance/invoices" format="currency" tone="amber" delay={0.12} />
        <PremiumStatCard label="Customers" description="CRM accounts" value={stats.customers.total} icon={Users} href="/crm/customers" tone="blue" delay={0.16} />
        <PremiumStatCard label="Employees" description="Active workforce" value={stats.employees.active} icon={UserCheck} href="/employees" tone="cyan" delay={0.2} />
        <PremiumStatCard label="Monthly Revenue" description="This month collections" value={stats.financials.monthlyRevenue} icon={Activity} growth={stats.growth.revenue} spark={stats.sparks.revenue} format="currency" tone="gold" delay={0.24} />
        <PremiumStatCard label="Monthly Expenses" description="This month spend" value={stats.financials.monthlyExpenses} icon={TrendingDown} growth={stats.growth.expenses} spark={stats.sparks.expenses} format="currency" tone="red" delay={0.28} />
      </section>

      {/* Today's Attendance */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
        <PremiumStatCard
          label="Today's Attendance"
          description="Records marked today"
          value={stats.attendance.total}
          icon={CalendarDays}
          href="/attendance"
          tone="blue"
          delay={0}
        />
        <PremiumStatCard
          label="Present"
          description="On-site present"
          value={stats.attendance.present}
          icon={CheckCircle2}
          href="/attendance"
          tone="green"
          delay={0.04}
        />
        <PremiumStatCard
          label="Absent"
          description="Not present today"
          value={stats.attendance.absent}
          icon={Users}
          href="/attendance"
          tone="red"
          delay={0.08}
        />
        <PremiumStatCard
          label="Late"
          description="Late arrivals"
          value={stats.attendance.late}
          icon={Clock}
          href="/attendance"
          tone="amber"
          delay={0.12}
        />
        <PremiumStatCard
          label="Half Day"
          description="Partial presence"
          value={stats.attendance.halfDay}
          icon={Activity}
          href="/attendance"
          tone="cyan"
          delay={0.16}
        />
        <PremiumStatCard
          label="On Leave"
          description="Approved leave"
          value={stats.attendance.leave}
          icon={Briefcase}
          href="/attendance"
          tone="blue"
          delay={0.2}
        />
        <PremiumStatCard
          label="Attendance %"
          description="Present rate vs active staff"
          value={stats.attendance.percentage}
          icon={Percent}
          href="/attendance"
          tone="gold"
          delay={0.24}
        />
      </section>

      {/* Analytics row */}
      <section className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Revenue Analytics</CardTitle>
              <p className="mt-1 text-xs text-[#64748B]">6-month live MongoDB trend</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => router.push("/reports")}>
              Full report <ArrowRight className="size-3.5" />
            </Button>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={stats.chartData}>
                <defs>
                  <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#D4AF37" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="month" stroke="#94A3B8" fontSize={12} />
                <YAxis stroke="#94A3B8" fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="revenue" stroke="#D4AF37" fill="url(#revFill)" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Project Mix</CardTitle>
            <p className="mt-1 text-xs text-[#64748B]">Status distribution</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={projectPie.length ? projectPie : [{ name: "None", value: 1 }]} dataKey="value" nameKey="name" innerRadius={58} outerRadius={86} paddingAngle={3}>
                  {(projectPie.length ? projectPie : [{ name: "None", value: 1 }]).map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {projectPie.map((p, i) => (
                <div key={p.name} className="flex items-center gap-2 text-xs text-[#64748B]">
                  <span className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  {p.name}: <span className="font-mono-num text-[#0F172A]">{p.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Expense Analytics</CardTitle>
            <p className="mt-1 text-xs text-[#64748B]">Spend vs profit by month</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={stats.chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="month" stroke="#94A3B8" fontSize={12} />
                <YAxis stroke="#94A3B8" fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="expenses" fill="#EF4444" radius={[8, 8, 0, 0]} />
                <Bar dataKey="profit" fill="#22C55E" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Performance Rings</CardTitle>
            <p className="mt-1 text-xs text-[#64748B]">Project completion & attendance</p>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <ResponsiveContainer width="100%" height={180}>
                <RadialBarChart innerRadius="55%" outerRadius="95%" data={[radialData[0]]} startAngle={90} endAngle={-270}>
                  <RadialBar background dataKey="value" cornerRadius={10} />
                </RadialBarChart>
              </ResponsiveContainer>
              <p className="text-center text-sm font-semibold">
                Completion <span className="font-mono-num text-[#C9A227]">{stats.projects.completionPct}%</span>
              </p>
            </div>
            <div>
              <ResponsiveContainer width="100%" height={180}>
                <RadialBarChart innerRadius="55%" outerRadius="95%" data={[radialData[1]]} startAngle={90} endAngle={-270}>
                  <RadialBar background dataKey="value" cornerRadius={10} />
                </RadialBarChart>
              </ResponsiveContainer>
              <p className="text-center text-sm font-semibold">
                Attendance{" "}
                <span className="font-mono-num text-emerald-600">
                  {stats.attendance.percentage || stats.employees.attendancePct}%
                </span>
              </p>
            </div>
            <div className="sm:col-span-2 grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                <p className="text-[10px] uppercase tracking-wider text-[#64748B]">Managers</p>
                <p className="mt-1 font-mono-num text-xl font-bold">{stats.employees.managers}</p>
              </div>
              <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                <p className="text-[10px] uppercase tracking-wider text-[#64748B]">Invoices</p>
                <p className="mt-1 font-mono-num text-xl font-bold">{stats.financials.invoices}</p>
              </div>
              <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                <p className="text-[10px] uppercase tracking-wider text-[#64748B]">Tasks Today</p>
                <p className="mt-1 font-mono-num text-xl font-bold">{stats.tasks.today}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Lists + calendar */}
      <section className="grid gap-6 xl:grid-cols-4">
        <Card className="xl:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="size-4 text-[#C9A227]" /> Calendar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-3 text-sm font-semibold">
              {new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" })}
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-[#64748B]">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <span key={d}>{d.charAt(0)}</span>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-7 gap-1">
              {calendarDays.map((c, i) => (
                <div
                  key={i}
                  className={`flex h-8 items-center justify-center rounded-lg text-xs ${
                    c.today
                      ? "bg-[#D4AF37] font-bold text-white shadow-lg shadow-amber-500/25"
                      : c.day
                        ? "text-[#64748B] hover:bg-[#F1F5F9]"
                        : ""
                  }`}
                >
                  {c.day ?? ""}
                </div>
              ))}
            </div>
            <Button className="mt-4 w-full" variant="secondary" size="sm" onClick={() => router.push("/tasks")}>
              <Plus className="size-3.5" /> Schedule task
            </Button>
          </CardContent>
        </Card>

        <Card className="xl:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Bell className="size-4 text-[#C9A227]" /> Notifications
            </CardTitle>
            <span className="rounded-full bg-[rgba(212,175,55,0.1)] px-2 py-0.5 text-[10px] font-bold text-[#C9A227]">
              {stats.notifications.unread}
            </span>
          </CardHeader>
          <CardContent className="space-y-2">
            {(stats.notifications.items?.length ? stats.notifications.items : stats.recentActivities.slice(0, 5)).map(
              (item: { _id: string; title?: string; message?: string; description?: string; createdAt: string }) => (
                <button
                  key={item._id}
                  type="button"
                  onClick={() => router.push("/notifications")}
                  className="w-full rounded-[14px] border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-left transition hover:bg-[rgba(212,175,55,0.1)]"
                >
                  <p className="text-sm font-medium">{item.title ?? item.description}</p>
                  <p className="mt-1 text-[11px] text-[#64748B]">
                    {item.message ?? formatDateTime(item.createdAt)}
                  </p>
                </button>
              )
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="size-4 text-[#C9A227]" /> Deadlines
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.upcomingDeadlines.length === 0 ? (
              <p className="text-sm text-[#64748B]">No upcoming deadlines</p>
            ) : (
              stats.upcomingDeadlines.map((d) => (
                <button
                  key={d._id}
                  type="button"
                  onClick={() => router.push("/projects")}
                  className="flex w-full items-center justify-between rounded-[14px] border border-[#E2E8F0] p-3 text-left hover:bg-[#F1F5F9]"
                >
                  <div>
                    <p className="text-sm font-medium">{d.name}</p>
                    <p className="text-[11px] text-[#64748B]">{formatDate(d.deadline)}</p>
                  </div>
                  <span className="font-mono-num text-xs text-[#C9A227]">{d.progress}%</span>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="size-4 text-cyan-300" /> Employee Pulse
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-2xl border border-[#E2E8F0] bg-gradient-to-br from-[rgba(212,175,55,0.08)] to-transparent p-4">
              <p className="text-xs text-[#64748B]">Active staff</p>
              <p className="mt-1 font-display text-3xl font-bold">{stats.employees.active}</p>
              <p className="mt-2 text-xs text-emerald-600">
                Today {stats.attendance.present + stats.attendance.late + stats.attendance.workFromHome} present ·{" "}
                {stats.attendance.percentage}%
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-[#E2E8F0] p-3">
                <Percent className="mb-2 size-4 text-[#C9A227]" />
                <p className="font-mono-num text-lg font-bold">{stats.attendance.percentage}%</p>
                <p className="text-[10px] text-[#64748B]">Attendance</p>
              </div>
              <div className="rounded-xl border border-[#E2E8F0] p-3">
                <CheckCircle2 className="mb-2 size-4 text-emerald-500" />
                <p className="font-mono-num text-lg font-bold">{stats.attendance.present}</p>
                <p className="text-[10px] text-[#64748B]">Present</p>
              </div>
            </div>
            <Button variant="secondary" className="w-full" size="sm" onClick={() => router.push("/attendance")}>
              Open Attendance
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Latest Customers</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => router.push("/crm/customers")}>
              View all
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.latestCustomers.map((c) => (
              <button
                key={c._id}
                type="button"
                onClick={() => router.push("/crm/customers")}
                className="flex w-full items-center justify-between rounded-[14px] border border-[#E2E8F0] p-3 text-left transition hover:bg-[#F1F5F9]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[rgba(212,175,55,0.1)] text-sm font-bold text-[#C9A227]">
                    {c.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{c.name}</p>
                    <p className="text-[11px] text-[#64748B]">{c.company ?? "Individual"}</p>
                  </div>
                </div>
                <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[10px] capitalize text-[#64748B]">
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
          <CardContent className="space-y-2">
            {stats.latestProjects.map((p) => (
              <button
                key={p._id}
                type="button"
                onClick={() => router.push("/projects")}
                className="w-full rounded-[14px] border border-[#E2E8F0] p-3 text-left transition hover:bg-[#F1F5F9]"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">{p.name}</p>
                  <span className="font-mono-num text-xs text-[#C9A227]">{p.progress}%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#F1F5F9]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#C9A227] to-[#D4AF37]"
                    style={{ width: `${Math.min(100, Number(p.progress) || 0)}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] capitalize text-[#64748B]">
                  {p.status} · due {formatDate(p.deadline)}
                </p>
              </button>
            ))}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activities</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {stats.recentActivities.length === 0 ? (
              <p className="text-sm text-[#64748B]">No recent activity logged</p>
            ) : (
              stats.recentActivities.map((a) => (
                <div
                  key={a._id}
                  className="flex items-center gap-4 rounded-[14px] border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3"
                >
                  <div className="h-2.5 w-2.5 rounded-full bg-[#D4AF37] shadow-[0_0_12px_#D4AF37]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{a.description}</p>
                    <p className="text-[11px] text-[#64748B]">by {a.userName}</p>
                  </div>
                  <p className="shrink-0 text-[11px] text-[#64748B]">{formatDateTime(a.createdAt)}</p>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

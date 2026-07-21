import { prisma } from "@/lib/prisma";
import { toDateKey } from "@/lib/attendance-utils";
import { withMongoIds, serializeNested } from "@/lib/serialize";

function monthBounds(offset = 0) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1);
  return { start, end };
}

function growthPct(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export async function getDashboardStats(userId: string) {
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const { start: curStart, end: curEnd } = monthBounds(0);
  const { start: prevStart, end: prevEnd } = monthBounds(-1);
  const todayKey = toDateKey(now);

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date();
  dayEnd.setHours(23, 59, 59, 999);

  const [
    customerAgg,
    projectGroups,
    employeeGroups,
    managerCount,
    expenseTotal,
    monthlyPayments,
    monthlyExpenseRows,
    recentActivities,
    unreadNotifications,
    upcomingDeadlines,
    latestPayments,
    latestCustomers,
    latestProjects,
    todayTasks,
    invoiceCount,
    curMonthRevenue,
    prevMonthRevenue,
    curMonthExpenses,
    prevMonthExpenses,
    attendanceAvg,
    notifications,
    todayAttendanceByStatus,
    todayAttendanceTotal
  ] = await prisma.$transaction([
    prisma.customer.aggregate({
      _count: { _all: true },
      _sum: { totalCost: true, paidAmount: true, remainingAmount: true }
    }),
    prisma.project.groupBy({
      by: ["status"],
      where: { isArchived: false },
      _count: { _all: true },
      _avg: { progress: true }
    }),
    prisma.employee.groupBy({
      by: ["status"],
      where: { isArchived: false },
      _count: { _all: true }
    }),
    prisma.employee.count({
      where: {
        status: "active",
        isArchived: false,
        position: { contains: "manager", mode: "insensitive" }
      }
    }),
    prisma.expense.aggregate({
      where: { isArchived: false },
      _sum: { amount: true }
    }),
    prisma.payment.groupBy({
      by: ["paidAt"],
      where: {
        isArchived: false,
        status: { in: ["paid", "partial"] },
        paidAt: { gte: sixMonthsAgo }
      },
      _sum: { grandTotal: true }
    }),
    prisma.expense.findMany({
      where: { isArchived: false, date: { gte: sixMonthsAgo } },
      select: { date: true, amount: true }
    }),
    prisma.activityLog.findMany({ orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.notification.count({ where: { userId, isRead: false } }),
    prisma.project.findMany({
      where: {
        deadline: { gte: now },
        status: { in: ["pending", "active"] },
        isArchived: false
      },
      orderBy: { deadline: "asc" },
      take: 6,
      select: { id: true, name: true, deadline: true, progress: true, status: true }
    }),
    prisma.payment.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { customer: { select: { name: true, company: true } } }
    }),
    prisma.customer.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, name: true, company: true, status: true, createdAt: true, totalCost: true }
    }),
    prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, name: true, status: true, progress: true, deadline: true, createdAt: true }
    }),
    prisma.task.count({
      where: {
        dueDate: { gte: dayStart, lte: dayEnd },
        status: { not: "done" },
        isArchived: false
      }
    }),
    prisma.payment.count({ where: { isArchived: false } }),
    prisma.payment.aggregate({
      where: {
        isArchived: false,
        status: { in: ["paid", "partial"] },
        paidAt: { gte: curStart, lt: curEnd }
      },
      _sum: { grandTotal: true }
    }),
    prisma.payment.aggregate({
      where: {
        isArchived: false,
        status: { in: ["paid", "partial"] },
        paidAt: { gte: prevStart, lt: prevEnd }
      },
      _sum: { grandTotal: true }
    }),
    prisma.expense.aggregate({
      where: { isArchived: false, date: { gte: curStart, lt: curEnd } },
      _sum: { amount: true }
    }),
    prisma.expense.aggregate({
      where: { isArchived: false, date: { gte: prevStart, lt: prevEnd } },
      _sum: { amount: true }
    }),
    prisma.employee.aggregate({
      where: { isArchived: false },
      _avg: { attendancePercentage: true }
    }),
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 8
    }),
    prisma.attendance.groupBy({
      by: ["status"],
      where: { dateKey: todayKey },
      _count: { _all: true }
    }),
    prisma.attendance.count({ where: { dateKey: todayKey } })
  ]);

  const customers = {
    total: customerAgg._count._all,
    totalRevenue: customerAgg._sum.totalCost ?? 0,
    totalReceived: customerAgg._sum.paidAmount ?? 0,
    totalPending: customerAgg._sum.remainingAmount ?? 0
  };
  const expenses = expenseTotal._sum.amount ?? 0;
  const totalRevenue = customers.totalReceived;
  const profit = totalRevenue - expenses;

  const projectCounts = {
    total: 0,
    active: 0,
    completed: 0,
    pending: 0,
    cancelled: 0,
    on_hold: 0,
    running: 0
  };
  let avgProgress = 0;
  for (const p of projectGroups) {
    const count = p._count._all;
    projectCounts.total += count;
    if (p.status === "active") {
      projectCounts.active = count;
      projectCounts.running = count;
    }
    if (p.status === "completed") projectCounts.completed = count;
    if (p.status === "pending") projectCounts.pending = count;
    if (p.status === "cancelled") projectCounts.cancelled = count;
    if (p.status === "on_hold") projectCounts.on_hold = count;
    avgProgress += (p._avg.progress ?? 0) * count;
  }
  if (projectCounts.total > 0) avgProgress /= projectCounts.total;

  let employeesActive = 0;
  let employeesTotal = 0;
  for (const e of employeeGroups) {
    employeesTotal += e._count._all;
    if (e.status === "active") employeesActive = e._count._all;
  }

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const chartData = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const rev = monthlyPayments
      .filter((r) => r.paidAt && r.paidAt.getFullYear() === year && r.paidAt.getMonth() === month)
      .reduce((sum, r) => sum + (r._sum.grandTotal ?? 0), 0);
    const exp = monthlyExpenseRows
      .filter((e) => e.date.getFullYear() === year && e.date.getMonth() === month)
      .reduce((sum, e) => sum + e.amount, 0);
    chartData.push({
      month: monthNames[month],
      revenue: rev,
      expenses: exp,
      profit: rev - exp
    });
  }

  const monthlyRevenueValue = curMonthRevenue._sum.grandTotal ?? 0;
  const monthlyExpensesValue = curMonthExpenses._sum.amount ?? 0;
  const monthlyProfitValue = monthlyRevenueValue - monthlyExpensesValue;
  const prevRev = prevMonthRevenue._sum.grandTotal ?? 0;
  const prevExp = prevMonthExpenses._sum.amount ?? 0;
  const prevProfit = prevRev - prevExp;

  const attendanceToday = {
    total: todayAttendanceTotal,
    present: 0,
    absent: 0,
    late: 0,
    halfDay: 0,
    leave: 0,
    workFromHome: 0,
    percentage: 0
  };
  for (const row of todayAttendanceByStatus) {
    const count = row._count._all;
    if (row.status === "present") attendanceToday.present = count;
    if (row.status === "absent") attendanceToday.absent = count;
    if (row.status === "late") attendanceToday.late = count;
    if (row.status === "half_day") attendanceToday.halfDay = count;
    if (row.status === "leave") attendanceToday.leave = count;
    if (row.status === "work_from_home") attendanceToday.workFromHome = count;
  }
  const countedPresent =
    attendanceToday.present + attendanceToday.late + attendanceToday.halfDay + attendanceToday.workFromHome;
  const denom = employeesActive > 0 ? employeesActive : attendanceToday.total;
  attendanceToday.percentage =
    denom > 0 ? Math.round((countedPresent / denom) * 100) : Math.round(attendanceAvg._avg.attendancePercentage ?? 0);

  const mapPayments = latestPayments.map((p) => ({
    ...p,
    customerId: p.customer ? { name: p.customer.name, company: p.customer.company } : p.customerId
  }));

  return {
    customers: {
      total: customers.total,
      revenue: customers.totalRevenue,
      received: customers.totalReceived,
      pending: customers.totalPending
    },
    projects: {
      ...projectCounts,
      avgProgress: Math.round(avgProgress),
      completionPct: projectCounts.total
        ? Math.round((projectCounts.completed / projectCounts.total) * 100)
        : 0
    },
    employees: {
      total: employeesTotal,
      active: employeesActive,
      managers: managerCount,
      attendancePct: attendanceToday.percentage || Math.round(attendanceAvg._avg.attendancePercentage ?? 100)
    },
    attendance: attendanceToday,
    financials: {
      totalRevenue,
      totalExpenses: expenses,
      totalProfit: profit,
      pendingPayments: customers.totalPending,
      monthlyRevenue: monthlyRevenueValue,
      monthlyExpenses: monthlyExpensesValue,
      monthlyProfit: monthlyProfitValue,
      invoices: invoiceCount
    },
    growth: {
      revenue: growthPct(monthlyRevenueValue, prevRev),
      expenses: growthPct(monthlyExpensesValue, prevExp),
      profit: growthPct(monthlyProfitValue, prevProfit)
    },
    tasks: { today: todayTasks },
    notifications: {
      unread: unreadNotifications,
      items: withMongoIds(serializeNested(notifications))
    },
    chartData,
    sparks: {
      revenue: chartData.map((c) => c.revenue),
      expenses: chartData.map((c) => c.expenses),
      profit: chartData.map((c) => c.profit)
    },
    recentActivities: withMongoIds(serializeNested(recentActivities)),
    upcomingDeadlines: withMongoIds(serializeNested(upcomingDeadlines)),
    latestPayments: withMongoIds(serializeNested(mapPayments)),
    latestCustomers: withMongoIds(serializeNested(latestCustomers)),
    latestProjects: withMongoIds(serializeNested(latestProjects)),
    monthlyGrowth: growthPct(monthlyRevenueValue, prevRev)
  };
}

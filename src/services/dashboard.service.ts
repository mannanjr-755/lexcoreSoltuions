import { connectDb } from "@/lib/db";
import { CustomerModel } from "@/models/Customer";
import { ProjectModel } from "@/models/Project";
import { EmployeeModel } from "@/models/Employee";
import { ExpenseModel } from "@/models/Expense";
import { PaymentModel } from "@/models/Payment";
import { ActivityLogModel } from "@/models/ActivityLog";
import { NotificationModel } from "@/models/Notification";
import { TaskModel } from "@/models/Task";
import { AttendanceModel, toDateKey } from "@/models/Attendance";

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
  await connectDb();

  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const { start: curStart, end: curEnd } = monthBounds(0);
  const { start: prevStart, end: prevEnd } = monthBounds(-1);

  const [
    customerStats,
    projectStats,
    employeeStats,
    managerCount,
    expenseStats,
    monthlyRevenue,
    monthlyExpenses,
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
  ] = await Promise.all([
    CustomerModel.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          totalRevenue: { $sum: "$totalCost" },
          totalReceived: { $sum: "$paidAmount" },
          totalPending: { $sum: "$remainingAmount" }
        }
      }
    ]),
    ProjectModel.aggregate([
      { $match: { isArchived: { $ne: true } } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          avgProgress: { $avg: "$progress" }
        }
      }
    ]),
    EmployeeModel.aggregate([
      { $match: { isArchived: { $ne: true } } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]),
    EmployeeModel.countDocuments({
      status: "active",
      isArchived: { $ne: true },
      position: { $regex: /manager|lead|director/i }
    }),
    ExpenseModel.aggregate([
      { $match: { isArchived: { $ne: true } } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]),
    PaymentModel.aggregate([
      {
        $match: {
          isArchived: { $ne: true },
          status: { $in: ["paid", "partial"] },
          paidAt: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: { year: { $year: "$paidAt" }, month: { $month: "$paidAt" } },
          revenue: { $sum: "$grandTotal" }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]),
    ExpenseModel.aggregate([
      { $match: { isArchived: { $ne: true }, date: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { year: { $year: "$date" }, month: { $month: "$date" } },
          expenses: { $sum: "$amount" }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]),
    ActivityLogModel.find().sort({ createdAt: -1 }).limit(12).lean(),
    NotificationModel.countDocuments({ userId, isRead: false }),
    ProjectModel.find({ deadline: { $gte: now }, status: { $in: ["pending", "active"] } })
      .sort({ deadline: 1 })
      .limit(6)
      .select("name deadline progress status")
      .lean(),
    PaymentModel.find()
      .sort({ createdAt: -1 })
      .limit(6)
      .populate("customerId", "name company")
      .lean(),
    CustomerModel.find().sort({ createdAt: -1 }).limit(6).select("name company status createdAt totalCost").lean(),
    ProjectModel.find().sort({ createdAt: -1 }).limit(6).select("name status progress deadline createdAt").lean(),
    (() => {
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date();
      dayEnd.setHours(23, 59, 59, 999);
      return TaskModel.countDocuments({
        dueDate: { $gte: dayStart, $lt: dayEnd },
        status: { $ne: "done" }
      });
    })(),
    PaymentModel.countDocuments(),
    PaymentModel.aggregate([
      {
        $match: {
          status: { $in: ["paid", "partial"] },
          paidAt: { $gte: curStart, $lt: curEnd }
        }
      },
      { $group: { _id: null, total: { $sum: "$grandTotal" } } }
    ]),
    PaymentModel.aggregate([
      {
        $match: {
          status: { $in: ["paid", "partial"] },
          paidAt: { $gte: prevStart, $lt: prevEnd }
        }
      },
      { $group: { _id: null, total: { $sum: "$grandTotal" } } }
    ]),
    ExpenseModel.aggregate([
      { $match: { date: { $gte: curStart, $lt: curEnd } } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]),
    ExpenseModel.aggregate([
      { $match: { date: { $gte: prevStart, $lt: prevEnd } } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]),
    EmployeeModel.aggregate([{ $group: { _id: null, avg: { $avg: "$attendancePercentage" } } }]),
    NotificationModel.find({ userId }).sort({ createdAt: -1 }).limit(8).lean(),
    AttendanceModel.aggregate([
      { $match: { dateKey: toDateKey(now) } },
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]),
    AttendanceModel.countDocuments({ dateKey: toDateKey(now) })
  ]);

  const customers = customerStats[0] ?? { total: 0, totalRevenue: 0, totalReceived: 0, totalPending: 0 };
  const expenses = expenseStats[0]?.total ?? 0;
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
  for (const p of projectStats) {
    projectCounts.total += p.count;
    if (p._id === "active") {
      projectCounts.active = p.count;
      projectCounts.running = p.count;
    }
    if (p._id === "completed") projectCounts.completed = p.count;
    if (p._id === "pending") projectCounts.pending = p.count;
    if (p._id === "cancelled") projectCounts.cancelled = p.count;
    if (p._id === "on_hold") projectCounts.on_hold = p.count;
    avgProgress += (p.avgProgress ?? 0) * p.count;
  }
  if (projectCounts.total > 0) avgProgress /= projectCounts.total;

  let employeesActive = 0;
  let employeesTotal = 0;
  for (const e of employeeStats) {
    employeesTotal += e.count;
    if (e._id === "active") employeesActive = e.count;
  }

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const chartData = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const rev = monthlyRevenue.find((r) => r._id.year === year && r._id.month === month);
    const exp = monthlyExpenses.find((e) => e._id.year === year && e._id.month === month);
    chartData.push({
      month: monthNames[d.getMonth()],
      revenue: rev?.revenue ?? 0,
      expenses: exp?.expenses ?? 0,
      profit: (rev?.revenue ?? 0) - (exp?.expenses ?? 0)
    });
  }

  const monthlyRevenueValue = curMonthRevenue[0]?.total ?? 0;
  const monthlyExpensesValue = curMonthExpenses[0]?.total ?? 0;
  const monthlyProfitValue = monthlyRevenueValue - monthlyExpensesValue;
  const prevRev = prevMonthRevenue[0]?.total ?? 0;
  const prevExp = prevMonthExpenses[0]?.total ?? 0;
  const prevProfit = prevRev - prevExp;

  const spark = chartData.map((c) => c.revenue);
  const sparkExp = chartData.map((c) => c.expenses);
  const sparkProfit = chartData.map((c) => c.profit);

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
    if (row._id === "present") attendanceToday.present = row.count;
    if (row._id === "absent") attendanceToday.absent = row.count;
    if (row._id === "late") attendanceToday.late = row.count;
    if (row._id === "half_day") attendanceToday.halfDay = row.count;
    if (row._id === "leave") attendanceToday.leave = row.count;
    if (row._id === "work_from_home") attendanceToday.workFromHome = row.count;
  }
  const countedPresent =
    attendanceToday.present + attendanceToday.late + attendanceToday.halfDay + attendanceToday.workFromHome;
  const denom = employeesActive > 0 ? employeesActive : attendanceToday.total;
  attendanceToday.percentage =
    denom > 0 ? Math.round((countedPresent / denom) * 100) : Math.round(attendanceAvg[0]?.avg ?? 0);

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
      attendancePct: attendanceToday.percentage || Math.round(attendanceAvg[0]?.avg ?? 100)
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
    tasks: { today: typeof todayTasks === "number" ? todayTasks : 0 },
    notifications: {
      unread: Number(unreadNotifications) || 0,
      items: Array.isArray(notifications) ? notifications : []
    },
    chartData,
    sparks: { revenue: spark, expenses: sparkExp, profit: sparkProfit },
    recentActivities: Array.isArray(recentActivities) ? recentActivities : [],
    upcomingDeadlines: Array.isArray(upcomingDeadlines) ? upcomingDeadlines : [],
    latestPayments: Array.isArray(latestPayments) ? latestPayments : [],
    latestCustomers: Array.isArray(latestCustomers) ? latestCustomers : [],
    latestProjects: Array.isArray(latestProjects) ? latestProjects : [],
    monthlyGrowth: growthPct(monthlyRevenueValue, prevRev)
  };
}

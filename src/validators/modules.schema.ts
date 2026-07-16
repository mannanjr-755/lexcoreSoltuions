import { z } from "zod";

export const projectSchema = z.object({
  name: z.string().min(2),
  customerId: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(["pending", "active", "on_hold", "completed", "cancelled"]).default("pending"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  progress: z.coerce.number().min(0).max(100).default(0),
  budget: z.coerce.number().min(0).default(0),
  spent: z.coerce.number().min(0).default(0),
  deadline: z.string().min(1),
  technologies: z.array(z.string()).optional(),
  isArchived: z.boolean().optional()
});

export const employeeSchema = z.object({
  employeeId: z.string().min(1),
  fullName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  department: z.string().min(1),
  position: z.string().min(1),
  salary: z.coerce.number().min(0).default(0),
  status: z.enum(["active", "inactive", "on_leave"]).default("active"),
  joinDate: z.string().optional(),
  attendancePercentage: z.coerce.number().min(0).max(100).default(100),
  isArchived: z.boolean().optional()
});

export const expenseSchema = z.object({
  title: z.string().min(2),
  category: z.enum([
    "office",
    "marketing",
    "hosting",
    "software",
    "electricity",
    "internet",
    "transport",
    "miscellaneous"
  ]),
  amount: z.coerce.number().min(0),
  description: z.string().optional(),
  date: z.string().min(1)
});

export const paymentSchema = z.object({
  invoiceNumber: z.string().min(1),
  customerId: z.string().min(1),
  projectId: z.string().optional(),
  amount: z.coerce.number().min(0),
  tax: z.coerce.number().min(0).default(0),
  discount: z.coerce.number().min(0).default(0),
  grandTotal: z.coerce.number().min(0),
  status: z.enum(["pending", "paid", "partial", "overdue", "cancelled"]).default("pending"),
  paymentMethod: z.enum(["cash", "bank", "card", "online"]).default("bank"),
  paidAt: z.string().optional(),
  dueDate: z.string().min(1),
  notes: z.string().optional()
});

export const taskSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  projectId: z.string().optional(),
  assigneeId: z.string().optional(),
  status: z.enum(["todo", "in_progress", "review", "done", "cancelled"]).default("todo"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  dueDate: z.string().optional(),
  isArchived: z.boolean().optional()
});

export const quotationSchema = z.object({
  quotationNumber: z.string().min(1),
  customerId: z.string().min(1),
  title: z.string().min(2),
  amount: z.coerce.number().min(0),
  tax: z.coerce.number().min(0).default(0),
  discount: z.coerce.number().min(0).default(0),
  grandTotal: z.coerce.number().min(0),
  status: z.enum(["draft", "sent", "accepted", "rejected", "expired"]).default("draft"),
  validUntil: z.string().min(1),
  notes: z.string().optional(),
  isArchived: z.boolean().optional()
});

export const attendanceSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  date: z.string().min(1, "Date is required"),
  status: z
    .enum(["present", "absent", "late", "half_day", "leave", "work_from_home"])
    .default("present"),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  department: z.string().optional(),
  remarks: z.string().optional(),
  notes: z.string().optional()
});

export const payrollSchema = z.object({
  employeeId: z.string().min(1),
  month: z.coerce.number().min(1).max(12),
  year: z.coerce.number().min(2000),
  basicSalary: z.coerce.number().min(0),
  allowances: z.coerce.number().min(0).default(0),
  deductions: z.coerce.number().min(0).default(0),
  netSalary: z.coerce.number().min(0),
  status: z.enum(["draft", "processed", "paid"]).default("draft"),
  paidAt: z.string().optional(),
  notes: z.string().optional()
});

export const documentSchema = z.object({
  title: z.string().min(2),
  category: z.enum(["contract", "invoice", "proposal", "policy", "other"]).default("other"),
  fileUrl: z.string().min(1),
  customerId: z.string().optional(),
  projectId: z.string().optional(),
  notes: z.string().optional(),
  isArchived: z.boolean().optional()
});

export const departmentSchema = z.object({
  name: z.string().min(2, "Department name is required"),
  code: z.string().optional(),
  description: z.string().optional(),
  managerName: z.string().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
  isArchived: z.boolean().optional()
});

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { handleApiError, unauthorized } from "@/lib/api-error";

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    if (!q || q.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const contains = { contains: q, mode: "insensitive" as const };

    const [customers, projects, employees, payments, expenses] = await Promise.all([
      prisma.customer.findMany({ where: { OR: [{ name: contains }, { email: contains }, { company: contains }] }, take: 5, select: { id: true, name: true, email: true, company: true, customerId: true } }),
      prisma.project.findMany({ where: { name: contains }, take: 5, select: { id: true, name: true, status: true, progress: true } }),
      prisma.employee.findMany({ where: { OR: [{ fullName: contains }, { email: contains }, { employeeId: contains }] }, take: 5, select: { id: true, fullName: true, email: true, employeeId: true, department: true } }),
      prisma.payment.findMany({ where: { invoiceNumber: contains }, take: 5, select: { id: true, invoiceNumber: true, grandTotal: true, status: true } }),
      prisma.expense.findMany({ where: { title: contains }, take: 5, select: { id: true, title: true, amount: true, category: true } })
    ]);

    return NextResponse.json({
      results: {
        customers: customers.map((c) => ({ ...c, type: "customer" })),
        projects: projects.map((p) => ({ ...p, type: "project" })),
        employees: employees.map((e) => ({ ...e, type: "employee" })),
        payments: payments.map((p) => ({ ...p, type: "payment" })),
        expenses: expenses.map((e) => ({ ...e, type: "expense" }))
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}

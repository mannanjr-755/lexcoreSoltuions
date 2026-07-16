import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { CustomerModel } from "@/models/Customer";
import { ProjectModel } from "@/models/Project";
import { EmployeeModel } from "@/models/Employee";
import { PaymentModel } from "@/models/Payment";
import { ExpenseModel } from "@/models/Expense";
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

    await connectDb();
    const regex = { $regex: q, $options: "i" };

    const [customers, projects, employees, payments, expenses] = await Promise.all([
      CustomerModel.find({ $or: [{ name: regex }, { email: regex }, { company: regex }] })
        .limit(5)
        .select("name email company customerId")
        .lean(),
      ProjectModel.find({ name: regex }).limit(5).select("name status progress").lean(),
      EmployeeModel.find({ $or: [{ fullName: regex }, { email: regex }, { employeeId: regex }] })
        .limit(5)
        .select("fullName email employeeId department")
        .lean(),
      PaymentModel.find({ invoiceNumber: regex }).limit(5).select("invoiceNumber grandTotal status").lean(),
      ExpenseModel.find({ title: regex }).limit(5).select("title amount category").lean()
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

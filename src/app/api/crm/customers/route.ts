import { NextResponse } from "next/server";
import { customerCreateSchema } from "@/validators/customer.schema";
import { customerRepository } from "@/repositories/customer.repository";
import { prisma } from "@/lib/prisma";
import { handleApiError, unauthorized } from "@/lib/api-error";
import { getSession } from "@/lib/auth";
import { getClientInfo, logActivity } from "@/lib/activity";

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const { searchParams } = new URL(req.url);
    const page = Math.max(Number(searchParams.get("page") ?? "1"), 1);
    const limit = Math.max(1, Math.min(Number(searchParams.get("limit") ?? "10"), 100));
    const query = searchParams.get("query");
    const status = searchParams.get("status");
    const sort = searchParams.get("sort") ?? "createdAt";

    const result = await customerRepository.list({ page, limit, query, status, sort });
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await req.json();
    const parsed = customerCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Validation failed", errors: parsed.error.flatten() }, { status: 400 });
    }

    const assignedManager = parsed.data.assignedManager || session.id;
    const created = await customerRepository.create({ ...parsed.data, assignedManager });
    if (!created) return NextResponse.json({ message: "Unable to create customer" }, { status: 500 });
    const paymentPercentage =
      created.totalCost > 0 ? Math.round((created.paidAmount / created.totalCost) * 100) : 0;

    const { ipAddress, userAgent, browser } = getClientInfo(req);
    await logActivity({
      userId: session.id,
      userName: session.fullName,
      action: "customer_added",
      entity: "customer",
      entityId: created.id,
      description: `Customer ${created.name} (${created.customerId}) added`,
      ipAddress,
      userAgent,
      browser,
      metadata: { paymentPercentage }
    });

    await prisma.notification.create({
      data: {
        userId: session.id,
        title: "New Customer Added",
        message: `${created.name} has been added as a new customer`,
        type: "customer",
        link: "/crm/customers"
      }
    });

    return NextResponse.json({ ...created, paymentPercentage }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await req.json();
    const ids = Array.isArray(body.ids) ? body.ids.filter((id: unknown) => typeof id === "string") : [];
    if (ids.length === 0) {
      return NextResponse.json({ message: "No customer IDs provided" }, { status: 400 });
    }

    await customerRepository.removeMany(ids);
    const { ipAddress, userAgent, browser } = getClientInfo(req);
    await logActivity({
      userId: session.id,
      userName: session.fullName,
      action: "customers_bulk_deleted",
      entity: "customer",
      description: `Bulk deleted ${ids.length} customer(s)`,
      ipAddress,
      userAgent,
      browser,
      metadata: { ids }
    });

    return NextResponse.json({ message: "Customers deleted", count: ids.length });
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextResponse } from "next/server";
import { customerUpdateSchema } from "@/validators/customer.schema";
import { customerRepository } from "@/repositories/customer.repository";
import { handleApiError, unauthorized } from "@/lib/api-error";
import { getSession } from "@/lib/auth";
import { getClientInfo, logActivity } from "@/lib/activity";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const { id } = await params;
    const customer = await customerRepository.findById(id);
    if (!customer) return NextResponse.json({ message: "Customer not found" }, { status: 404 });

    return NextResponse.json({ customer });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const { id } = await params;
    const body = await req.json();
    const parsed = customerUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Validation failed", errors: parsed.error.flatten() }, { status: 400 });
    }

    const updated = await customerRepository.update(id, parsed.data);
    if (!updated) return NextResponse.json({ message: "Customer not found" }, { status: 404 });

    const paymentPercentage =
      updated.totalCost > 0 ? Math.round((updated.paidAmount / updated.totalCost) * 100) : 0;

    const { ipAddress, userAgent, browser } = getClientInfo(req);
    await logActivity({
      userId: session.id,
      userName: session.fullName,
      action: "customer_updated",
      entity: "customer",
      entityId: id,
      description: `Customer ${updated.name} updated`,
      ipAddress,
      userAgent,
      browser
    });

    return NextResponse.json({ customer: updated, paymentPercentage });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const { id } = await params;
    const deleted = await customerRepository.remove(id);
    if (!deleted) return NextResponse.json({ message: "Customer not found" }, { status: 404 });

    const { ipAddress, userAgent, browser } = getClientInfo(req);
    await logActivity({
      userId: session.id,
      userName: session.fullName,
      action: "customer_deleted",
      entity: "customer",
      entityId: id,
      description: `Customer ${deleted.name} deleted`,
      ipAddress,
      userAgent,
      browser
    });

    return NextResponse.json({ message: "Record permanently deleted", deleted: true, id });
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { handleApiError, unauthorized } from "@/lib/api-error";
import { calcWorkingHours, toDateKey, parseDateOnly } from "@/lib/attendance-utils";
import { attendanceSchema } from "@/validators/modules.schema";
import { syncEmployeeAttendancePercentage } from "@/lib/sync-attendance";
import { withMongoId, serializeNested } from "@/lib/serialize";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    if (!(await getSession())) return unauthorized();
    const { id } = await ctx.params;
    const doc = await prisma.attendance.findUnique({
      where: { id },
      include: { employee: { select: { id: true, fullName: true, department: true, employeeId: true } } }
    });
    if (!doc) return NextResponse.json({ message: "Record not found" }, { status: 404 });
    const serialized = withMongoId(serializeNested(doc)) as Record<string, unknown> & { employee?: unknown };
    return NextResponse.json({ ...serialized, employeeId: serialized.employee });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    if (!(await getSession())) return unauthorized();
    const { id } = await ctx.params;
    const parsed = attendanceSchema.partial().safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ message: "Validation failed", errors: parsed.error.flatten() }, { status: 400 });

    const existing = await prisma.attendance.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ message: "Record not found" }, { status: 404 });
    const data = parsed.data;
    const employee = data.employeeId
      ? await prisma.employee.findUnique({ where: { id: data.employeeId } })
      : null;
    if (data.employeeId && !employee) return NextResponse.json({ message: "Employee not found" }, { status: 404 });

    const employeeId = employee?.id ?? existing.employeeId;
    const dateKey = data.date ? toDateKey(data.date) : existing.dateKey;
    if (data.date || data.employeeId) {
      const clash = await prisma.attendance.findUnique({ where: { employeeId_dateKey: { employeeId, dateKey } } });
      if (clash && clash.id !== id) return NextResponse.json({ message: `Attendance already exists for this employee on ${dateKey}.` }, { status: 409 });
    }

    const checkIn = data.checkIn ?? existing.checkIn;
    const checkOut = data.checkOut ?? existing.checkOut;
    const updated = await prisma.attendance.update({
      where: { id },
      data: {
        ...(employee ? { employeeId: employee.id, employeeName: employee.fullName, department: data.department ?? employee.department } : {}),
        ...(data.date ? { date: parseDateOnly(data.date), dateKey } : {}),
        ...(data.status ? { status: data.status } : {}),
        ...(data.checkIn !== undefined ? { checkIn: data.checkIn } : {}),
        ...(data.checkOut !== undefined ? { checkOut: data.checkOut } : {}),
        ...(data.department !== undefined ? { department: data.department } : {}),
        ...(data.remarks !== undefined ? { remarks: data.remarks, notes: data.remarks } : {}),
        ...(data.notes !== undefined ? { notes: data.notes, ...(data.remarks === undefined ? { remarks: data.notes } : {}) } : {}),
        workingHours: calcWorkingHours(checkIn, checkOut)
      },
      include: { employee: { select: { id: true, fullName: true, department: true, employeeId: true } } }
    });
    await syncEmployeeAttendancePercentage(employeeId);
    const serialized = withMongoId(serializeNested(updated)) as Record<string, unknown> & { employee?: unknown };
    return NextResponse.json({ ...serialized, employeeId: serialized.employee });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    if (!(await getSession())) return unauthorized();
    const { id } = await ctx.params;
    const existing = await prisma.attendance.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ message: "Record not found" }, { status: 404 });
    await prisma.attendance.delete({ where: { id } });
    await syncEmployeeAttendancePercentage(existing.employeeId);
    return NextResponse.json({ message: "Record permanently deleted", deleted: true, id });
  } catch (error) {
    return handleApiError(error);
  }
}

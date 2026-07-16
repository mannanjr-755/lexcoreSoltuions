import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { handleApiError, unauthorized } from "@/lib/api-error";
import { getClientInfo, logActivity } from "@/lib/activity";
import { calcWorkingHours, toDateKey, parseDateOnly } from "@/lib/attendance-utils";
import { attendanceSchema } from "@/validators/modules.schema";
import { ensureStaffEmployees } from "@/lib/ensure-staff";
import { syncEmployeeAttendancePercentage } from "@/lib/sync-attendance";
import { withMongoId, withMongoIds, serializeNested } from "@/lib/serialize";

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    await ensureStaffEmployees();
    const { searchParams } = new URL(req.url);
    const page = Math.max(Number(searchParams.get("page") ?? "1"), 1);
    const limit = Math.max(1, Math.min(Number(searchParams.get("limit") ?? "10"), 100));
    const query = searchParams.get("query")?.trim();
    const status = searchParams.get("status");
    const department = searchParams.get("department");
    const date = searchParams.get("date");
    const where = {
      ...(status ? { status: status as never } : {}),
      ...(department ? { department } : {}),
      ...(date ? { dateKey: date } : {}),
      ...(query
        ? { OR: ["employeeName", "department", "remarks", "status"].map((field) => ({ [field]: { contains: query, mode: "insensitive" as const } })) }
        : {})
    };
    const [data, total] = await Promise.all([
      prisma.attendance.findMany({ where, orderBy: [{ date: "desc" }, { createdAt: "desc" }], skip: (page - 1) * limit, take: limit, include: { employee: { select: { id: true, fullName: true, department: true, employeeId: true, email: true } } } }),
      prisma.attendance.count({ where })
    ]);
    const rows = withMongoIds(serializeNested(data)) as Array<Record<string, unknown> & { employee?: unknown }>;
    return NextResponse.json({ data: rows.map((row) => ({ ...row, employeeId: row.employee })), total });
  } catch (error) { return handleApiError(error); }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const body = await req.json();
    if (body?.action === "duplicate" && typeof body.id === "string") {
      const existing = await prisma.attendance.findUnique({ where: { id: body.id } });
      if (!existing) return NextResponse.json({ message: "Record not found" }, { status: 404 });
      const date = new Date(existing.date);
      for (let attempts = 0; attempts < 60; attempts++) {
        date.setDate(date.getDate() + 1);
        const dateKey = toDateKey(date);
        if (!await prisma.attendance.findUnique({ where: { employeeId_dateKey: { employeeId: existing.employeeId, dateKey } } })) {
          const duplicate = await prisma.attendance.create({ data: { employeeId: existing.employeeId, employeeName: existing.employeeName, department: existing.department, date, dateKey, status: existing.status, checkIn: existing.checkIn, checkOut: existing.checkOut, workingHours: existing.workingHours, remarks: `${existing.remarks} (copy)`.trim(), notes: existing.notes } });
          return NextResponse.json(withMongoId(serializeNested(duplicate)), { status: 201 });
        }
      }
      return NextResponse.json({ message: "Could not find an available date to duplicate this attendance." }, { status: 409 });
    }
    if (body?.action === "bulkUpdate" && Array.isArray(body.ids)) {
      await prisma.attendance.updateMany({ where: { id: { in: body.ids.filter((id: unknown): id is string => typeof id === "string") } }, data: body.data ?? {} });
      return NextResponse.json({ message: "Updated", count: body.ids.length });
    }
    const parsed = attendanceSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ message: "Validation failed", errors: parsed.error.flatten() }, { status: 400 });
    const employee = await prisma.employee.findUnique({ where: { id: parsed.data.employeeId } });
    if (!employee) return NextResponse.json({ message: "Employee not found" }, { status: 404 });
    const date = parseDateOnly(parsed.data.date);
    const dateKey = toDateKey(parsed.data.date);
    if (await prisma.attendance.findUnique({ where: { employeeId_dateKey: { employeeId: employee.id, dateKey } } })) return NextResponse.json({ message: `Attendance already exists for ${employee.fullName} on ${dateKey}.` }, { status: 409 });
    const created = await prisma.attendance.create({ data: { employeeId: employee.id, employeeName: employee.fullName, department: parsed.data.department || employee.department, date, dateKey, status: parsed.data.status, checkIn: parsed.data.checkIn ?? "", checkOut: parsed.data.checkOut ?? "", workingHours: calcWorkingHours(parsed.data.checkIn, parsed.data.checkOut), remarks: parsed.data.remarks ?? parsed.data.notes ?? "", notes: parsed.data.notes ?? parsed.data.remarks ?? "" } });
    await syncEmployeeAttendancePercentage(employee.id);
    const { ipAddress, userAgent, browser } = getClientInfo(req);
    await logActivity({ userId: session.id, userName: session.fullName, action: "attendance_created", entity: "attendance", entityId: created.id, description: `Attendance marked for ${employee.fullName} (${parsed.data.status})`, ipAddress, userAgent, browser });
    return NextResponse.json(withMongoId(serializeNested(created)), { status: 201 });
  } catch (error) { return handleApiError(error); }
}

export async function DELETE(req: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const body = await req.json();
    const ids = Array.isArray(body.ids) ? body.ids.filter((id: unknown): id is string => typeof id === "string") : [];
    if (!ids.length) return NextResponse.json({ message: "No IDs provided" }, { status: 400 });
    const deleted = await prisma.attendance.deleteMany({ where: { id: { in: ids } } });
    return NextResponse.json({ message: "Attendance records deleted", count: deleted.count });
  } catch (error) { return handleApiError(error); }
}

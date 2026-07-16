import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { handleApiError, unauthorized } from "@/lib/api-error";
import { getClientInfo, logActivity } from "@/lib/activity";
import { AttendanceModel, calcWorkingHours, toDateKey, parseDateOnly } from "@/models/Attendance";
import { EmployeeModel } from "@/models/Employee";
import { attendanceSchema } from "@/validators/modules.schema";
import { ensureStaffEmployees } from "@/lib/ensure-staff";
import { syncEmployeeAttendancePercentage } from "@/lib/sync-attendance";

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    await ensureStaffEmployees();
    await connectDb();

    const { searchParams } = new URL(req.url);
    const page = Math.max(Number(searchParams.get("page") ?? "1"), 1);
    const limit = Math.max(1, Math.min(Number(searchParams.get("limit") ?? "10"), 100));
    const query = searchParams.get("query")?.trim();
    const status = searchParams.get("status");
    const department = searchParams.get("department");
    const date = searchParams.get("date");

    const match: Record<string, unknown> = {};
    if (status) match.status = status;
    if (department) match.department = department;
    if (date) match.dateKey = date;
    if (query) {
      match.$or = [
        { employeeName: { $regex: query, $options: "i" } },
        { department: { $regex: query, $options: "i" } },
        { remarks: { $regex: query, $options: "i" } },
        { status: { $regex: query, $options: "i" } }
      ];
    }

    const [raw, total] = await Promise.all([
      AttendanceModel.find(match)
        .sort({ date: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("employeeId", "fullName department employeeId email")
        .lean(),
      AttendanceModel.countDocuments(match)
    ]);

    // Backfill legacy rows missing dateKey / employeeName (from older schema)
    const data = await Promise.all(
      raw.map(async (row) => {
        const needsKey = !row.dateKey;
        const needsName = !row.employeeName;
        if (!needsKey && !needsName) return row;

        const dateKey = needsKey ? toDateKey(row.date as Date) : row.dateKey;
        let employeeName = row.employeeName as string | undefined;
        let department = (row.department as string | undefined) ?? "";
        if (needsName) {
          const emp =
            typeof row.employeeId === "object" && row.employeeId && "fullName" in row.employeeId
              ? (row.employeeId as { fullName?: string; department?: string })
              : await EmployeeModel.findById(row.employeeId).select("fullName department").lean();
          employeeName = emp?.fullName ?? "Unknown";
          if (!department) department = emp?.department ?? "";
        }

        await AttendanceModel.updateOne(
          { _id: row._id },
          {
            $set: {
              ...(needsKey ? { dateKey } : {}),
              ...(needsName ? { employeeName, department } : {}),
              remarks: row.remarks ?? row.notes ?? ""
            }
          }
        );

        return { ...row, dateKey, employeeName, department };
      })
    );

    return NextResponse.json({ data, total });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    await connectDb();

    const body = await req.json();

    if (body?.action === "duplicate" && typeof body.id === "string") {
      const existing = await AttendanceModel.findById(body.id).lean();
      if (!existing || Array.isArray(existing)) {
        return NextResponse.json({ message: "Record not found" }, { status: 404 });
      }
      const copy = { ...(existing as Record<string, unknown>) };
      delete copy._id;
      delete copy.createdAt;
      delete copy.updatedAt;
      delete copy.__v;

      const base = new Date(String(copy.date));
      let dateKey = "";
      let attempts = 0;
      do {
        base.setDate(base.getDate() + 1);
        dateKey = toDateKey(base);
        const clash = await AttendanceModel.findOne({
          employeeId: copy.employeeId as Types.ObjectId,
          dateKey
        }).lean();
        if (!clash) break;
        attempts += 1;
      } while (attempts < 60);

      if (attempts >= 60) {
        return NextResponse.json(
          { message: "Could not find an available date to duplicate this attendance." },
          { status: 409 }
        );
      }

      const duplicate = await AttendanceModel.create({
        ...copy,
        date: base,
        dateKey,
        remarks: `${copy.remarks ?? ""} (copy)`.trim()
      });
      return NextResponse.json(duplicate, { status: 201 });
    }

    if (body?.action === "bulkUpdate" && Array.isArray(body.ids)) {
      await AttendanceModel.updateMany({ _id: { $in: body.ids } }, body.data ?? {});
      return NextResponse.json({ message: "Updated", count: body.ids.length });
    }

    const parsed = attendanceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Validation failed", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const employee = await EmployeeModel.findById(parsed.data.employeeId);
    if (!employee) {
      return NextResponse.json({ message: "Employee not found" }, { status: 404 });
    }

    const date = parseDateOnly(parsed.data.date);
    const dateKey = toDateKey(parsed.data.date);

    const exists = await AttendanceModel.findOne({ employeeId: employee._id, dateKey });
    if (exists) {
      return NextResponse.json(
        { message: `Attendance already exists for ${employee.fullName} on ${dateKey}.` },
        { status: 409 }
      );
    }

    const workingHours = calcWorkingHours(parsed.data.checkIn, parsed.data.checkOut);
    const created = await AttendanceModel.create({
      employeeId: employee._id,
      employeeName: employee.fullName,
      department: parsed.data.department || employee.department || "",
      date,
      dateKey,
      status: parsed.data.status,
      checkIn: parsed.data.checkIn ?? "",
      checkOut: parsed.data.checkOut ?? "",
      workingHours,
      remarks: parsed.data.remarks ?? parsed.data.notes ?? "",
      notes: parsed.data.notes ?? parsed.data.remarks ?? ""
    });

    await syncEmployeeAttendancePercentage(String(employee._id));

    const { ipAddress, userAgent, browser } = getClientInfo(req);
    await logActivity({
      userId: session.id,
      userName: session.fullName,
      action: "attendance_created",
      entity: "attendance",
      entityId: created._id.toString(),
      description: `Attendance marked for ${employee.fullName} (${parsed.data.status})`,
      ipAddress,
      userAgent,
      browser
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    await connectDb();

    const body = await req.json();
    const ids = Array.isArray(body.ids) ? body.ids.filter((id: unknown) => typeof id === "string") : [];
    if (ids.length === 0) {
      return NextResponse.json({ message: "No IDs provided" }, { status: 400 });
    }

    await AttendanceModel.deleteMany({ _id: { $in: ids } });
    return NextResponse.json({ message: "Attendance records deleted", count: ids.length });
  } catch (error) {
    return handleApiError(error);
  }
}

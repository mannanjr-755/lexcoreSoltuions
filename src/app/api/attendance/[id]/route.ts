import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { handleApiError, unauthorized } from "@/lib/api-error";
import { AttendanceModel, calcWorkingHours, toDateKey, parseDateOnly } from "@/models/Attendance";
import { EmployeeModel } from "@/models/Employee";
import { attendanceSchema } from "@/validators/modules.schema";
import { syncEmployeeAttendancePercentage } from "@/lib/sync-attendance";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    await connectDb();
    const { id } = await ctx.params;
    const doc = await AttendanceModel.findById(id).populate("employeeId", "fullName department employeeId").lean();
    if (!doc) return NextResponse.json({ message: "Record not found" }, { status: 404 });
    return NextResponse.json(doc);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    await connectDb();
    const { id } = await ctx.params;
    const body = await req.json();

    const parsed = attendanceSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Validation failed", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await AttendanceModel.findById(id);
    if (!existing) return NextResponse.json({ message: "Record not found" }, { status: 404 });

    const data = parsed.data;
    if (data.employeeId) {
      const employee = await EmployeeModel.findById(data.employeeId);
      if (!employee) return NextResponse.json({ message: "Employee not found" }, { status: 404 });
      existing.employeeId = employee._id;
      existing.employeeName = String(employee.fullName ?? "");
      if (!data.department) existing.department = String(employee.department ?? "");
    }

    if (data.date) {
      const date = parseDateOnly(data.date);
      const dateKey = toDateKey(data.date);
      const clash = await AttendanceModel.findOne({
        _id: { $ne: existing._id },
        employeeId: existing.employeeId,
        dateKey
      });
      if (clash) {
        return NextResponse.json(
          { message: `Attendance already exists for this employee on ${dateKey}.` },
          { status: 409 }
        );
      }
      existing.date = date;
      existing.dateKey = dateKey;
    }

    if (data.status) existing.status = data.status;
    if (data.checkIn !== undefined) existing.checkIn = data.checkIn;
    if (data.checkOut !== undefined) existing.checkOut = data.checkOut;
    if (data.department !== undefined) existing.department = data.department;
    if (data.remarks !== undefined) {
      existing.remarks = data.remarks;
      existing.notes = data.remarks;
    }
    if (data.notes !== undefined) {
      existing.notes = data.notes;
      if (data.remarks === undefined) existing.remarks = data.notes;
    }

    existing.workingHours = calcWorkingHours(existing.checkIn ?? "", existing.checkOut ?? "");
    await existing.save();
    await syncEmployeeAttendancePercentage(String(existing.employeeId));

    const populated = await AttendanceModel.findById(existing._id)
      .populate("employeeId", "fullName department employeeId")
      .lean();

    return NextResponse.json(populated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    await connectDb();
    const { id } = await ctx.params;
    const existing = await AttendanceModel.findById(id);
    if (!existing) return NextResponse.json({ message: "Record not found" }, { status: 404 });
    const employeeId = String(existing.employeeId);
    const deleted = await AttendanceModel.findByIdAndDelete(id);
    if (!deleted) return NextResponse.json({ message: "Record not found" }, { status: 404 });

    const stillThere = await AttendanceModel.exists({ _id: id });
    if (stillThere) {
      return NextResponse.json({ message: "Delete verification failed" }, { status: 500 });
    }

    await syncEmployeeAttendancePercentage(employeeId);
    return NextResponse.json({ message: "Record permanently deleted", deleted: true, id });
  } catch (error) {
    return handleApiError(error);
  }
}

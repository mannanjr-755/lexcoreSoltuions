import { connectDb } from "@/lib/db";
import { AttendanceModel } from "@/models/Attendance";
import { EmployeeModel } from "@/models/Employee";

/** Recalculate an employee's attendancePercentage from Mongo attendance history. */
export async function syncEmployeeAttendancePercentage(employeeId: string) {
  await connectDb();
  const total = await AttendanceModel.countDocuments({ employeeId });
  if (total === 0) {
    await EmployeeModel.findByIdAndUpdate(employeeId, { attendancePercentage: 100 });
    return 100;
  }

  const positive = await AttendanceModel.countDocuments({
    employeeId,
    status: { $in: ["present", "late", "half_day", "work_from_home"] }
  });
  const percentage = Math.round((positive / total) * 100);
  await EmployeeModel.findByIdAndUpdate(employeeId, { attendancePercentage: percentage });
  return percentage;
}

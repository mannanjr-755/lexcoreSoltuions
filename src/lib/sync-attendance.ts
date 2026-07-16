import { prisma } from "@/lib/prisma";

/** Recalculate an employee's attendancePercentage from attendance history. */
export async function syncEmployeeAttendancePercentage(employeeId: string) {
  const total = await prisma.attendance.count({ where: { employeeId } });
  if (total === 0) {
    await prisma.employee.update({
      where: { id: employeeId },
      data: { attendancePercentage: 100 }
    });
    return 100;
  }

  const positive = await prisma.attendance.count({
    where: {
      employeeId,
      status: { in: ["present", "late", "half_day", "work_from_home"] }
    }
  });
  const percentage = Math.round((positive / total) * 100);
  await prisma.employee.update({
    where: { id: employeeId },
    data: { attendancePercentage: percentage }
  });
  return percentage;
}

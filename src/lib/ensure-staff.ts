import { connectDb } from "@/lib/db";
import { EmployeeModel } from "@/models/Employee";

const STAFF = [
  {
    employeeId: "EMP-001",
    fullName: "Abdul-Mannan",
    email: "abdul.mannan@lexcore.com",
    department: "Engineering",
    position: "Software Engineer",
    salary: 120000
  },
  {
    employeeId: "EMP-002",
    fullName: "Raid Zia",
    email: "raid.zia@lexcore.com",
    department: "Engineering",
    position: "Frontend Developer",
    salary: 110000
  },
  {
    employeeId: "EMP-003",
    fullName: "Muhammad-Yousuf",
    email: "muhammad.yousuf@lexcore.com",
    department: "Operations",
    position: "Project Coordinator",
    salary: 100000
  },
  {
    employeeId: "EMP-004",
    fullName: "Anjasha",
    email: "anjasha@lexcore.com",
    department: "HR",
    position: "HR Executive",
    salary: 95000
  }
] as const;

/** Ensures Lexcore staff exist in MongoDB so Attendance dropdown always has real employees. */
export async function ensureStaffEmployees() {
  await connectDb();

  for (const staff of STAFF) {
    const existing = await EmployeeModel.findOne({
      $or: [{ employeeId: staff.employeeId }, { email: staff.email }, { fullName: staff.fullName }]
    });

    if (!existing) {
      await EmployeeModel.create({
        ...staff,
        phone: "",
        status: "active",
        joinDate: new Date(),
        attendancePercentage: 100,
        isArchived: false
      });
    }
  }

  return EmployeeModel.find({ isArchived: { $ne: true }, status: { $ne: "inactive" } })
    .sort({ fullName: 1 })
    .select("_id employeeId fullName department position email status")
    .lean();
}

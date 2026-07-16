import { prisma } from "@/lib/prisma";
import { withMongoIds, serializeNested } from "@/lib/serialize";

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

/** Ensures Lexcore staff exist so Attendance dropdown always has real employees. */
export async function ensureStaffEmployees() {
  for (const staff of STAFF) {
    const existing = await prisma.employee.findFirst({
      where: {
        OR: [{ employeeId: staff.employeeId }, { email: staff.email }, { fullName: staff.fullName }]
      }
    });

    if (!existing) {
      await prisma.employee.create({
        data: {
          ...staff,
          phone: "",
          status: "active",
          joinDate: new Date(),
          attendancePercentage: 100,
          isArchived: false
        }
      });
    }
  }

  const employees = await prisma.employee.findMany({
    where: { isArchived: false, status: { not: "inactive" } },
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      employeeId: true,
      fullName: true,
      department: true,
      position: true,
      email: true,
      status: true
    }
  });

  return withMongoIds(serializeNested(employees));
}

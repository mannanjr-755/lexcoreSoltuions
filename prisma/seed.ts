import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const databaseUrl =
  process.env.DIRECT_URL?.trim() ||
  process.env.DATABASE_URL?.trim() ||
  "postgresql://127.0.0.1:5432/lexcore";

const prisma = new PrismaClient({
  datasources: { db: { url: databaseUrl } }
});

const departments = [
  { name: "Engineering", code: "ENG", description: "Product & software delivery", managerName: "Abdul-Mannan" },
  { name: "Operations", code: "OPS", description: "Project coordination & delivery ops", managerName: "Muhammad-Yousuf" },
  { name: "HR", code: "HR", description: "People & culture", managerName: "Anjasha" },
  { name: "General", code: "GEN", description: "General administration", managerName: "" }
];

const staff = [
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
];

async function main() {
  const email = (process.env.SUPER_ADMIN_EMAIL ?? "admin@lexcore.com").toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD ?? "Lexcore@2026!";
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    update: {
      role: "super_admin",
      isActive: true,
      passwordHash,
      fullName: process.env.SUPER_ADMIN_NAME ?? "Super Admin"
    },
    create: {
      fullName: process.env.SUPER_ADMIN_NAME ?? "Super Admin",
      email,
      passwordHash,
      role: "super_admin",
      company: "Lexcore Solutions",
      designation: "Super Admin"
    }
  });

  for (const department of departments) {
    await prisma.department.upsert({
      where: { name: department.name },
      update: department,
      create: { ...department, status: "active" }
    });
  }

  for (const member of staff) {
    await prisma.employee.upsert({
      where: { employeeId: member.employeeId },
      update: {
        fullName: member.fullName,
        email: member.email,
        department: member.department,
        position: member.position,
        salary: member.salary,
        status: "active",
        isArchived: false
      },
      create: {
        ...member,
        phone: "",
        status: "active",
        joinDate: new Date(),
        attendancePercentage: 100,
        isArchived: false
      }
    });
  }

  // refresh department employee counts
  for (const department of departments) {
    const employeeCount = await prisma.employee.count({
      where: { department: department.name, isArchived: false }
    });
    await prisma.department.update({
      where: { name: department.name },
      data: { employeeCount }
    });
  }

  if (!(await prisma.systemSettings.findFirst())) {
    await prisma.systemSettings.create({
      data: {
        companyName: "Lexcore Solutions",
        theme: "light",
        currency: "PKR"
      }
    });
  }

  console.log("Seed complete: Super Admin, departments, staff, settings");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

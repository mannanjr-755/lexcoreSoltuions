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

/** Must stay in sync with src/lib/authorized-users.ts */
const authorizedUsers = [
  {
    email: "admin@lexcore.com",
    name: "Admin",
    roleTitle: "Administrator",
    passwordEnvKey: "AUTH_PASSWORD_ADMIN",
    defaultPassword: "Admin@Lexcore1!"
  },
  {
    email: "abdul@lexcore.com",
    name: "Abdul",
    roleTitle: "Software Engineer",
    passwordEnvKey: "AUTH_PASSWORD_ABDUL",
    defaultPassword: "Abdul@Lexcore1!"
  },
  {
    email: "raid@lexcore.com",
    name: "Raid",
    roleTitle: "Frontend Developer",
    passwordEnvKey: "AUTH_PASSWORD_RAID",
    defaultPassword: "Raid@Lexcore1!"
  },
  {
    email: "yousuf@lexcore.com",
    name: "Yousuf",
    roleTitle: "Project Coordinator",
    passwordEnvKey: "AUTH_PASSWORD_YOUSUF",
    defaultPassword: "Yousuf@Lexcore1!"
  },
  {
    email: "anjasha@lexcore.com",
    name: "Anjasha",
    roleTitle: "HR Executive",
    passwordEnvKey: "AUTH_PASSWORD_ANJASHA",
    defaultPassword: "Anjasha@Lexcore1!"
  }
];

function resolvePassword(passwordEnvKey: string, defaultPassword: string) {
  const fromEnv = process.env[passwordEnvKey]?.trim();
  if (fromEnv && fromEnv.length >= 8) return fromEnv;
  if (passwordEnvKey === "AUTH_PASSWORD_ADMIN") {
    const superAdmin = process.env.SUPER_ADMIN_PASSWORD?.trim();
    const legacy = new Set(["Lexcore@2026!", "Lexcore@2026", "admin123", "Admin123!"]);
    if (superAdmin && superAdmin.length >= 8 && !legacy.has(superAdmin)) return superAdmin;
  }
  return defaultPassword;
}

async function main() {
  for (const member of authorizedUsers) {
    const password = resolvePassword(member.passwordEnvKey, member.defaultPassword);
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.upsert({
      where: { email: member.email },
      update: {
        role: "super_admin",
        isActive: true,
        passwordHash,
        fullName: member.name,
        company: "Lexcore Solutions",
        designation: member.roleTitle,
        failedLoginAttempts: 0,
        lockedUntil: null
      },
      create: {
        fullName: member.name,
        email: member.email,
        passwordHash,
        role: "super_admin",
        company: "Lexcore Solutions",
        designation: member.roleTitle,
        isActive: true,
        failedLoginAttempts: 0
      }
    });
  }

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

  console.log("Seed complete: 5 authorized users, departments, staff, settings");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

import { prisma } from "@/lib/prisma";
import { departmentSchema } from "@/validators/modules.schema";
import { createCrudHandlers } from "@/lib/crud-factory";

const DEFAULT_DEPARTMENTS = [
  { name: "Engineering", code: "ENG", description: "Product & software delivery", managerName: "Abdul-Mannan" },
  { name: "Operations", code: "OPS", description: "Project coordination & delivery ops", managerName: "Muhammad-Yousuf" },
  { name: "HR", code: "HR", description: "People & culture", managerName: "Anjasha" },
  { name: "General", code: "GEN", description: "General administration", managerName: "" }
];

async function ensureDepartments() {
  for (const dept of DEFAULT_DEPARTMENTS) {
    const existing = await prisma.department.findUnique({ where: { name: dept.name } });
    const employeeCount = await prisma.employee.count({
      where: { department: dept.name, isArchived: false }
    });
    if (!existing) {
      await prisma.department.create({ data: { ...dept, status: "active", employeeCount } });
    } else if (existing.employeeCount !== employeeCount) {
      await prisma.department.update({ where: { id: existing.id }, data: { employeeCount } });
    }
  }
}

const handlers = createCrudHandlers({
  entity: "department",
  delegate: prisma.department,
  schema: departmentSchema,
  searchFields: ["name", "code", "description", "managerName"]
});

export async function GET(req: Request) {
  await ensureDepartments();
  return handlers.GET(req);
}

export const POST = handlers.POST;
export const DELETE = handlers.DELETE;

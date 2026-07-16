import { DepartmentModel } from "@/models/Department";
import { departmentSchema } from "@/validators/modules.schema";
import { createCrudHandlers } from "@/lib/crud-factory";
import { connectDb } from "@/lib/db";
import { EmployeeModel } from "@/models/Employee";

const DEFAULT_DEPARTMENTS = [
  { name: "Engineering", code: "ENG", description: "Product & software delivery", managerName: "Abdul-Mannan" },
  { name: "Operations", code: "OPS", description: "Project coordination & delivery ops", managerName: "Muhammad-Yousuf" },
  { name: "HR", code: "HR", description: "People & culture", managerName: "Anjasha" },
  { name: "General", code: "GEN", description: "General administration", managerName: "" }
];

async function ensureDepartments() {
  await connectDb();
  for (const dept of DEFAULT_DEPARTMENTS) {
    const existing = await DepartmentModel.findOne({ name: dept.name });
    if (!existing) {
      const employeeCount = await EmployeeModel.countDocuments({
        department: dept.name,
        isArchived: { $ne: true }
      });
      await DepartmentModel.create({ ...dept, status: "active", employeeCount });
    } else {
      const employeeCount = await EmployeeModel.countDocuments({
        department: dept.name,
        isArchived: { $ne: true }
      });
      if (existing.employeeCount !== employeeCount) {
        existing.employeeCount = employeeCount;
        await existing.save();
      }
    }
  }
}

const handlers = createCrudHandlers({
  model: DepartmentModel,
  entity: "department",
  schema: departmentSchema,
  searchFields: ["name", "code", "description", "managerName"]
});

export async function GET(req: Request) {
  await ensureDepartments();
  return handlers.GET(req);
}

export const POST = handlers.POST;
export const DELETE = handlers.DELETE;

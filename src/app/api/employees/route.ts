import { prisma } from "@/lib/prisma";
import { employeeSchema } from "@/validators/modules.schema";
import { createCrudHandlers } from "@/lib/crud-factory";
import { ensureStaffEmployees } from "@/lib/ensure-staff";

const handlers = createCrudHandlers({
  entity: "employee",
  delegate: prisma.employee,
  schema: employeeSchema,
  searchFields: ["fullName", "email", "employeeId", "department", "position"],
  transformCreate: (data) => ({
    ...data,
    ...(data.joinDate ? { joinDate: new Date(String(data.joinDate)) } : {})
  }),
  transformUpdate: (data) => ({
    ...data,
    ...(data.joinDate ? { joinDate: new Date(String(data.joinDate)) } : {})
  })
});

export async function GET(req: Request) {
  await ensureStaffEmployees();
  return handlers.GET(req);
}

export const POST = handlers.POST;
export const DELETE = handlers.DELETE;

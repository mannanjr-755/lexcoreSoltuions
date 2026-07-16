import { prisma } from "@/lib/prisma";
import { departmentSchema } from "@/validators/modules.schema";
import { createCrudHandlers } from "@/lib/crud-factory";

const handlers = createCrudHandlers({
  entity: "department",
  delegate: prisma.department,
  schema: departmentSchema,
  searchFields: ["name", "code"]
});

export const GET = handlers.GET_ONE;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE_ONE;

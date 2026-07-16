import { prisma } from "@/lib/prisma";
import { expenseSchema } from "@/validators/modules.schema";
import { createCrudHandlers } from "@/lib/crud-factory";

const handlers = createCrudHandlers({
  entity: "expense",
  delegate: prisma.expense,
  schema: expenseSchema,
  searchFields: ["title"],
  transformUpdate: (data) => ({
    ...data,
    ...(data.date ? { date: new Date(String(data.date)) } : {})
  })
});

export const GET = handlers.GET_ONE;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE_ONE;

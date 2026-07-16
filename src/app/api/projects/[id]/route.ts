import { prisma } from "@/lib/prisma";
import { projectSchema } from "@/validators/modules.schema";
import { createCrudHandlers } from "@/lib/crud-factory";

const handlers = createCrudHandlers({
  entity: "project",
  delegate: prisma.project,
  schema: projectSchema,
  searchFields: ["name"],
  include: { customer: { select: { id: true, name: true, company: true } } },
  mapRow: (row) => ({
    ...row,
    customerId: row.customer
  }),
  transformUpdate: (data) => ({
    ...data,
    ...(data.deadline ? { deadline: new Date(String(data.deadline)) } : {})
  })
});

export const GET = handlers.GET_ONE;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE_ONE;

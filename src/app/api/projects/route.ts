import { prisma } from "@/lib/prisma";
import { projectSchema } from "@/validators/modules.schema";
import { createCrudHandlers } from "@/lib/crud-factory";

const handlers = createCrudHandlers({
  entity: "project",
  delegate: prisma.project,
  schema: projectSchema,
  searchFields: ["name", "description", "status"],
  include: { customer: { select: { id: true, name: true, company: true } } },
  mapRow: (row) => ({
    ...row,
    customerId: row.customer
  }),
  transformCreate: (data) => ({
    ...data,
    deadline: new Date(String(data.deadline)),
    technologies: data.technologies ?? []
  }),
  transformUpdate: (data) => ({
    ...data,
    ...(data.deadline ? { deadline: new Date(String(data.deadline)) } : {})
  })
});

export const GET = handlers.GET;
export const POST = handlers.POST;
export const DELETE = handlers.DELETE;

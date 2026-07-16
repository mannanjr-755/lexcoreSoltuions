import { prisma } from "@/lib/prisma";
import { documentSchema } from "@/validators/modules.schema";
import { createCrudHandlers } from "@/lib/crud-factory";

const handlers = createCrudHandlers({
  entity: "document",
  delegate: prisma.document,
  schema: documentSchema,
  searchFields: ["title"],
  include: {
    customer: { select: { id: true, name: true, company: true } },
    project: { select: { id: true, name: true } }
  },
  mapRow: (row) => ({ ...row, customerId: row.customer ?? row.customerId, projectId: row.project ?? row.projectId })
});

export const GET = handlers.GET_ONE;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE_ONE;

import { prisma } from "@/lib/prisma";
import { paymentSchema } from "@/validators/modules.schema";
import { createCrudHandlers } from "@/lib/crud-factory";

const handlers = createCrudHandlers({
  entity: "payment",
  delegate: prisma.payment,
  schema: paymentSchema,
  searchFields: ["invoiceNumber"],
  include: {
    customer: { select: { id: true, name: true, company: true } },
    project: { select: { id: true, name: true } }
  },
  mapRow: (row) => ({ ...row, customerId: row.customer, projectId: row.project ?? row.projectId }),
  transformUpdate: (data) => ({
    ...data,
    ...(data.dueDate ? { dueDate: new Date(String(data.dueDate)) } : {}),
    ...(data.paidAt ? { paidAt: new Date(String(data.paidAt)) } : {})
  })
});

export const GET = handlers.GET_ONE;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE_ONE;

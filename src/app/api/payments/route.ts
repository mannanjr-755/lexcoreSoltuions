import { prisma } from "@/lib/prisma";
import { paymentSchema } from "@/validators/modules.schema";
import { createCrudHandlers } from "@/lib/crud-factory";

const handlers = createCrudHandlers({
  entity: "payment",
  delegate: prisma.payment,
  schema: paymentSchema,
  searchFields: ["invoiceNumber", "status", "notes"],
  include: {
    customer: { select: { id: true, name: true, company: true } },
    project: { select: { id: true, name: true } }
  },
  mapRow: (row) => ({ ...row, customerId: row.customer, projectId: row.project ?? row.projectId }),
  transformCreate: (data) => ({
    ...data,
    dueDate: new Date(String(data.dueDate)),
    ...(data.paidAt ? { paidAt: new Date(String(data.paidAt)) } : {}),
    ...(data.status === "paid" && !data.paidAt ? { paidAt: new Date() } : {})
  }),
  transformUpdate: (data) => ({
    ...data,
    ...(data.dueDate ? { dueDate: new Date(String(data.dueDate)) } : {}),
    ...(data.paidAt ? { paidAt: new Date(String(data.paidAt)) } : {})
  })
});

export const GET = handlers.GET;
export const POST = handlers.POST;
export const DELETE = handlers.DELETE;

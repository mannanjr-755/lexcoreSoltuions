import { prisma } from "@/lib/prisma";
import { quotationSchema } from "@/validators/modules.schema";
import { createCrudHandlers } from "@/lib/crud-factory";

const handlers = createCrudHandlers({
  entity: "quotation",
  delegate: prisma.quotation,
  schema: quotationSchema,
  searchFields: ["quotationNumber"],
  include: { customer: { select: { id: true, name: true, company: true } } },
  mapRow: (row) => ({ ...row, customerId: row.customer }),
  transformUpdate: (data) => ({
    ...data,
    ...(data.validUntil ? { validUntil: new Date(String(data.validUntil)) } : {})
  })
});

export const GET = handlers.GET_ONE;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE_ONE;

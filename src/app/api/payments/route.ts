import { PaymentModel } from "@/models/Payment";
import { paymentSchema } from "@/validators/modules.schema";
import { createCrudHandlers } from "@/lib/crud-factory";

const handlers = createCrudHandlers({
  model: PaymentModel,
  entity: "payment",
  schema: paymentSchema,
  searchFields: ["invoiceNumber", "status", "notes"],
  populate: ["customerId", "projectId"],
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

import { QuotationModel } from "@/models/Quotation";
import { quotationSchema } from "@/validators/modules.schema";
import { createCrudHandlers } from "@/lib/crud-factory";

const handlers = createCrudHandlers({
  model: QuotationModel,
  entity: "quotation",
  schema: quotationSchema,
  searchFields: ["quotationNumber", "title", "status"],
  populate: "customerId",
  transformCreate: (data) => ({
    ...data,
    validUntil: new Date(String(data.validUntil))
  }),
  transformUpdate: (data) => ({
    ...data,
    ...(data.validUntil ? { validUntil: new Date(String(data.validUntil)) } : {})
  })
});

export const GET = handlers.GET;
export const POST = handlers.POST;
export const DELETE = handlers.DELETE;

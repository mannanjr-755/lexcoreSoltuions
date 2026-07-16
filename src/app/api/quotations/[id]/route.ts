import { QuotationModel } from "@/models/Quotation";
import { quotationSchema } from "@/validators/modules.schema";
import { createCrudHandlers } from "@/lib/crud-factory";

const handlers = createCrudHandlers({
  model: QuotationModel,
  entity: "quotation",
  schema: quotationSchema,
  searchFields: ["quotationNumber"],
  populate: "customerId",
  transformUpdate: (data) => ({
    ...data,
    ...(data.validUntil ? { validUntil: new Date(String(data.validUntil)) } : {})
  })
});

export const GET = handlers.GET_ONE;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE_ONE;

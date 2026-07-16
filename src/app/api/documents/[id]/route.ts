import { DocumentModel } from "@/models/Document";
import { documentSchema } from "@/validators/modules.schema";
import { createCrudHandlers } from "@/lib/crud-factory";

const handlers = createCrudHandlers({
  model: DocumentModel,
  entity: "document",
  schema: documentSchema,
  searchFields: ["title"],
  populate: ["customerId", "projectId"]
});

export const GET = handlers.GET_ONE;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE_ONE;

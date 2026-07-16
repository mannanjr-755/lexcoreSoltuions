import { DocumentModel } from "@/models/Document";
import { documentSchema } from "@/validators/modules.schema";
import { createCrudHandlers } from "@/lib/crud-factory";

const handlers = createCrudHandlers({
  model: DocumentModel,
  entity: "document",
  schema: documentSchema,
  searchFields: ["title", "category", "notes"],
  populate: ["customerId", "projectId"],
  transformCreate: (data, sessionId) => ({
    ...data,
    uploadedBy: sessionId
  })
});

export const GET = handlers.GET;
export const POST = handlers.POST;
export const DELETE = handlers.DELETE;

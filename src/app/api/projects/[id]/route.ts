import { ProjectModel } from "@/models/Project";
import { projectSchema } from "@/validators/modules.schema";
import { createCrudHandlers } from "@/lib/crud-factory";

const handlers = createCrudHandlers({
  model: ProjectModel,
  entity: "project",
  schema: projectSchema,
  searchFields: ["name"],
  populate: "customerId",
  transformUpdate: (data) => ({
    ...data,
    ...(data.deadline ? { deadline: new Date(String(data.deadline)) } : {})
  })
});

export const GET = handlers.GET_ONE;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE_ONE;

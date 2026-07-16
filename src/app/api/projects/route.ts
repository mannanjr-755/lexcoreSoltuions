import { ProjectModel } from "@/models/Project";
import { projectSchema } from "@/validators/modules.schema";
import { createCrudHandlers } from "@/lib/crud-factory";

const handlers = createCrudHandlers({
  model: ProjectModel,
  entity: "project",
  schema: projectSchema,
  searchFields: ["name", "description", "status"],
  populate: "customerId",
  transformCreate: (data) => ({
    ...data,
    deadline: new Date(String(data.deadline)),
    technologies: data.technologies ?? []
  }),
  transformUpdate: (data) => ({
    ...data,
    ...(data.deadline ? { deadline: new Date(String(data.deadline)) } : {})
  })
});

export const GET = handlers.GET;
export const POST = handlers.POST;
export const DELETE = handlers.DELETE;

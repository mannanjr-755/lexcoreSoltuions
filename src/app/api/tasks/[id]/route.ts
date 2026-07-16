import { TaskModel } from "@/models/Task";
import { taskSchema } from "@/validators/modules.schema";
import { createCrudHandlers } from "@/lib/crud-factory";

const handlers = createCrudHandlers({
  model: TaskModel,
  entity: "task",
  schema: taskSchema,
  searchFields: ["title"],
  populate: ["projectId", "assigneeId"],
  transformUpdate: (data) => ({
    ...data,
    ...(data.dueDate ? { dueDate: new Date(String(data.dueDate)) } : {})
  })
});

export const GET = handlers.GET_ONE;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE_ONE;

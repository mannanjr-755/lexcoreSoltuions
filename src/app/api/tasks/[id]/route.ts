import { prisma } from "@/lib/prisma";
import { taskSchema } from "@/validators/modules.schema";
import { createCrudHandlers } from "@/lib/crud-factory";

const handlers = createCrudHandlers({
  entity: "task",
  delegate: prisma.task,
  schema: taskSchema,
  searchFields: ["title"],
  include: {
    project: { select: { id: true, name: true } },
    assignee: { select: { id: true, fullName: true, employeeId: true } }
  },
  mapRow: (row) => ({ ...row, projectId: row.project ?? row.projectId, assigneeId: row.assignee ?? row.assigneeId }),
  transformUpdate: (data) => ({
    ...data,
    ...(data.dueDate ? { dueDate: new Date(String(data.dueDate)) } : {})
  })
});

export const GET = handlers.GET_ONE;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE_ONE;

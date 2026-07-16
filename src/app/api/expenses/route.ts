import { ExpenseModel } from "@/models/Expense";
import { expenseSchema } from "@/validators/modules.schema";
import { createCrudHandlers } from "@/lib/crud-factory";

const handlers = createCrudHandlers({
  model: ExpenseModel,
  entity: "expense",
  schema: expenseSchema,
  searchFields: ["title", "category", "description"],
  transformCreate: (data, sessionId) => ({
    ...data,
    date: new Date(String(data.date)),
    createdBy: sessionId
  }),
  transformUpdate: (data) => ({
    ...data,
    ...(data.date ? { date: new Date(String(data.date)) } : {})
  })
});

export const GET = handlers.GET;
export const POST = handlers.POST;
export const DELETE = handlers.DELETE;

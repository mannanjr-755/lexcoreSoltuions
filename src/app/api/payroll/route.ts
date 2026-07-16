import { PayrollModel } from "@/models/Payroll";
import { payrollSchema } from "@/validators/modules.schema";
import { createCrudHandlers } from "@/lib/crud-factory";

const handlers = createCrudHandlers({
  model: PayrollModel,
  entity: "payroll",
  schema: payrollSchema,
  searchFields: ["status", "notes"],
  populate: "employeeId",
  transformCreate: (data) => ({
    ...data,
    ...(data.paidAt ? { paidAt: new Date(String(data.paidAt)) } : {})
  }),
  transformUpdate: (data) => ({
    ...data,
    ...(data.paidAt ? { paidAt: new Date(String(data.paidAt)) } : {})
  })
});

export const GET = handlers.GET;
export const POST = handlers.POST;
export const DELETE = handlers.DELETE;

import { PayrollModel } from "@/models/Payroll";
import { payrollSchema } from "@/validators/modules.schema";
import { createCrudHandlers } from "@/lib/crud-factory";

const handlers = createCrudHandlers({
  model: PayrollModel,
  entity: "payroll",
  schema: payrollSchema,
  searchFields: ["status"],
  populate: "employeeId",
  transformUpdate: (data) => ({
    ...data,
    ...(data.paidAt ? { paidAt: new Date(String(data.paidAt)) } : {})
  })
});

export const GET = handlers.GET_ONE;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE_ONE;

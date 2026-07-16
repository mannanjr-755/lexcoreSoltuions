import { EmployeeModel } from "@/models/Employee";
import { employeeSchema } from "@/validators/modules.schema";
import { createCrudHandlers } from "@/lib/crud-factory";

const handlers = createCrudHandlers({
  model: EmployeeModel,
  entity: "employee",
  schema: employeeSchema,
  searchFields: ["fullName"],
  transformUpdate: (data) => ({
    ...data,
    ...(data.joinDate ? { joinDate: new Date(String(data.joinDate)) } : {})
  })
});

export const GET = handlers.GET_ONE;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE_ONE;

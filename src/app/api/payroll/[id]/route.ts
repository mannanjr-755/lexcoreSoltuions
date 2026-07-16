import { prisma } from "@/lib/prisma";
import { payrollSchema } from "@/validators/modules.schema";
import { createCrudHandlers } from "@/lib/crud-factory";

const handlers = createCrudHandlers({
  entity: "payroll",
  delegate: prisma.payroll,
  schema: payrollSchema,
  searchFields: ["status"],
  include: { employee: { select: { id: true, fullName: true, employeeId: true } } },
  mapRow: (row) => ({ ...row, employeeId: row.employee ?? row.employeeId }),
  transformUpdate: (data) => ({
    ...data,
    ...(data.paidAt ? { paidAt: new Date(String(data.paidAt)) } : {})
  })
});

export const GET = handlers.GET_ONE;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE_ONE;

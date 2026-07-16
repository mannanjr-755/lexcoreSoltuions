import { prisma } from "@/lib/prisma";
import { payrollSchema } from "@/validators/modules.schema";
import { createCrudHandlers } from "@/lib/crud-factory";

const handlers = createCrudHandlers({
  entity: "payroll",
  delegate: prisma.payroll,
  schema: payrollSchema,
  searchFields: ["status", "notes"],
  include: { employee: { select: { id: true, fullName: true, employeeId: true } } },
  mapRow: (row) => ({ ...row, employeeId: row.employee ?? row.employeeId }),
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

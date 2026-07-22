import { z } from "zod";

export const customerStatusEnum = z.enum(["lead", "active", "on_hold", "completed", "cancelled"]);
export const customerPriorityEnum = z.enum(["low", "medium", "high", "urgent"]);

export const customerCreateSchema = z.object({
  name: z.string().min(2, "Name is required"),
  phone: z.string().min(7, "Phone is required"),
  whatsapp: z.string().optional().or(z.literal("")),
  email: z.string().email("Valid email required"),
  company: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  projectName: z.string().min(2, "Project name is required"),
  projectType: z.string().min(2, "Project type is required"),
  technology: z.array(z.string()).optional(),
  assignedManager: z.string().min(1).optional(),
  totalCost: z.number().nonnegative("Total cost must be >= 0"),
  advancePaid: z.number().nonnegative().optional(),
  paidAmount: z.number().nonnegative().optional(),
  projectDeadline: z.string().min(1, "Deadline is required"),
  priority: customerPriorityEnum.optional(),
  status: customerStatusEnum.optional(),
  notes: z.string().optional().or(z.literal(""))
});

export const customerUpdateSchema = customerCreateSchema.partial();

export type CustomerCreateInput = z.infer<typeof customerCreateSchema>;
export type CustomerUpdateInput = z.infer<typeof customerUpdateSchema>;

export function calculateCustomerPayments(totalCost: number, advancePaid: number, paidAmount: number) {
  const totalPaid = Math.max(0, advancePaid + paidAmount);
  const remainingAmount = Math.max(0, totalCost - totalPaid);
  const paymentPercentage = totalCost > 0 ? Math.round((totalPaid / totalCost) * 100) : 0;
  return { paidAmount: totalPaid, remainingAmount, paymentPercentage };
}

export function toCustomerPayload(input: CustomerCreateInput | CustomerUpdateInput) {
  return {
    ...input,
    projectDeadline: input.projectDeadline ? new Date(input.projectDeadline) : undefined,
    totalCost: input.totalCost != null ? Number(input.totalCost) : undefined,
    advancePaid: input.advancePaid != null ? Number(input.advancePaid) : undefined,
    paidAmount: input.paidAmount != null ? Number(input.paidAmount) : undefined
  };
}

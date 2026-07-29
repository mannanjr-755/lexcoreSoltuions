import { z } from "zod";

export const customerStatusEnum = z.enum(["lead", "active", "on_hold", "completed", "cancelled"]);
export const customerPriorityEnum = z.enum(["low", "medium", "high", "urgent"]);

const moneyField = (message = "Amount must be 0 or greater") =>
  z
    .any()
    .transform((value) => {
      if (value === "" || value === null || value === undefined) return 0;
      if (typeof value === "number" && Number.isNaN(value)) return 0;
      const parsed = typeof value === "number" ? value : Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    })
    .pipe(z.number().nonnegative(message));

const optionalText = z
  .string()
  .optional()
  .or(z.literal(""))
  .transform((value) => {
    if (value == null) return undefined;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  });

export const customerCreateSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  phone: z
    .string()
    .trim()
    .min(7, "Phone is required")
    .max(30, "Phone number is too long")
    .regex(/^[0-9+\-\s()]+$/, "Enter a valid phone number"),
  whatsapp: optionalText,
  address: optionalText,
  projectName: z.string().trim().min(2, "Project name is required"),
  projectType: z.string().trim().min(2, "Project type is required"),
  technology: z.array(z.string()).optional(),
  assignedManager: z.string().min(1).optional(),
  totalCost: moneyField("Total cost must be >= 0"),
  advancePaid: moneyField().optional(),
  paidAmount: moneyField().optional(),
  projectDeadline: z
    .string()
    .min(1, "Deadline is required")
    .refine((value) => !Number.isNaN(new Date(value).getTime()), "Enter a valid deadline"),
  priority: customerPriorityEnum.optional(),
  status: customerStatusEnum.optional(),
  notes: optionalText
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

/** Display phone as +92XXXXXXXXXX when possible. */
export function formatCustomerPhone(phone: string): string {
  const raw = phone.trim();
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("92") && digits.length >= 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length >= 10) return `+92${digits.slice(1)}`;
  if (digits.length === 10) return `+92${digits}`;
  if (raw.startsWith("+")) return raw;
  return raw;
}

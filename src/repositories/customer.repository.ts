import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { withMongoId, withMongoIds, serializeNested } from "@/lib/serialize";
import { HttpError } from "@/lib/api-error";
import { logger } from "@/lib/logger";
import {
  calculateCustomerPayments,
  type CustomerCreateInput,
  type CustomerUpdateInput
} from "@/validators/customer.schema";

function normalizeOptional(value?: string | null) {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

let schemaReady: Promise<void> | null = null;

/**
 * Ensures legacy customer email/company columns are dropped so inserts never hit NOT NULL email.
 */
export async function ensureCustomerSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      try {
        await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "customers_email_idx"`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "customers" DROP COLUMN IF EXISTS "email"`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "customers" DROP COLUMN IF EXISTS "company"`);
      } catch (error) {
        schemaReady = null;
        logger.warn("Customer schema reconcile skipped", {
          message: error instanceof Error ? error.message : String(error)
        });
      }
    })();
  }
  await schemaReady;
}

/**
 * Collision-resistant customer IDs:
 * LC-YYMMDD-XXXXXX (date + 6 hex chars from crypto random).
 * Never depends on scanning existing rows, so concurrent creates cannot collide.
 */
function generateCustomerId() {
  const now = new Date();
  const datePart = [
    String(now.getFullYear()).slice(-2),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("");
  const rand = randomBytes(3).toString("hex").toUpperCase();
  return `LC-${datePart}-${rand}`;
}

function isCustomerIdUniqueViolation(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error)) return false;
  if ((error as { code?: string }).code !== "P2002") return false;
  const target = (error as { meta?: { target?: unknown } }).meta?.target;
  if (Array.isArray(target)) {
    return target.some((field) => String(field).toLowerCase().includes("customerid"));
  }
  return String(target ?? "").toLowerCase().includes("customerid");
}

async function assertNoDuplicatePhone(phone: string, excludeId?: string) {
  const normalized = phone.trim();
  const existing = await prisma.customer.findFirst({
    where: {
      phone: normalized,
      ...(excludeId ? { NOT: { id: excludeId } } : {})
    },
    select: { customerId: true, name: true }
  });
  if (existing) {
    throw new HttpError(
      409,
      `A customer with phone "${normalized}" already exists (${existing.customerId}).`
    );
  }
}

export const customerRepository = {
  async list(params: { page: number; limit: number; query?: string | null; status?: string | null; sort?: string }) {
    await ensureCustomerSchema();

    const where: Record<string, unknown> = {};
    if (params.status) where.status = params.status;
    if (params.query) {
      where.OR = [
        { name: { contains: params.query, mode: "insensitive" } },
        { projectName: { contains: params.query, mode: "insensitive" } },
        { customerId: { contains: params.query, mode: "insensitive" } },
        { phone: { contains: params.query, mode: "insensitive" } }
      ];
    }

    const orderBy =
      params.sort === "name" ? { name: "asc" as const } : { createdAt: "desc" as const };

    const [data, total, aggregates] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy,
        skip: (params.page - 1) * params.limit,
        take: params.limit
      }),
      prisma.customer.count({ where }),
      prisma.customer.aggregate({
        where,
        _sum: {
          totalCost: true,
          paidAmount: true,
          remainingAmount: true
        }
      })
    ]);

    return {
      data: withMongoIds(serializeNested(data)),
      total,
      financials: {
        totalCost: aggregates._sum.totalCost ?? 0,
        paidAmount: aggregates._sum.paidAmount ?? 0,
        remainingAmount: aggregates._sum.remainingAmount ?? 0
      }
    };
  },

  async create(input: CustomerCreateInput & { assignedManager: string }) {
    await ensureCustomerSchema();

    const phone = input.phone.trim();
    await assertNoDuplicatePhone(phone);

    const payments = calculateCustomerPayments(input.totalCost, input.advancePaid ?? 0, input.paidAmount ?? 0);
    const deadline = new Date(input.projectDeadline);
    if (Number.isNaN(deadline.getTime())) {
      throw new HttpError(400, "Enter a valid project deadline.");
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const customerId = generateCustomerId();
      try {
        const created = await prisma.customer.create({
          data: {
            customerId,
            name: input.name.trim(),
            phone,
            whatsapp: normalizeOptional(input.whatsapp),
            address: normalizeOptional(input.address),
            projectName: input.projectName.trim(),
            projectType: input.projectType.trim(),
            technology: input.technology ?? [],
            assignedManager: input.assignedManager,
            totalCost: input.totalCost,
            advancePaid: input.advancePaid ?? 0,
            paidAmount: payments.paidAmount,
            remainingAmount: payments.remainingAmount,
            projectDeadline: deadline,
            priority: input.priority ?? "medium",
            status: input.status ?? "lead",
            notes: normalizeOptional(input.notes)
          }
        });
        logger.info("Customer created", { customerId: created.customerId, phone: created.phone });
        return withMongoId(serializeNested(created))!;
      } catch (error) {
        if (!isCustomerIdUniqueViolation(error) || attempt === 4) {
          throw error;
        }
        logger.warn("Customer ID collision — regenerating", { attempt: attempt + 1, customerId });
      }
    }

    throw new HttpError(500, "Unable to allocate a unique customer ID. Please try again.");
  },

  async update(id: string, input: CustomerUpdateInput) {
    await ensureCustomerSchema();

    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) return null;

    const nextPhone = input.phone !== undefined ? input.phone.trim() : existing.phone;
    if (input.phone !== undefined) {
      await assertNoDuplicatePhone(nextPhone, id);
    }

    const totalCost = input.totalCost ?? existing.totalCost;
    const advancePaid = input.advancePaid ?? existing.advancePaid;
    const additionalPaid =
      input.paidAmount !== undefined
        ? input.paidAmount
        : Math.max(0, existing.paidAmount - existing.advancePaid);
    const payments = calculateCustomerPayments(totalCost, advancePaid, additionalPaid);

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.phone !== undefined ? { phone: nextPhone } : {}),
        ...(input.whatsapp !== undefined ? { whatsapp: normalizeOptional(input.whatsapp) } : {}),
        ...(input.address !== undefined ? { address: normalizeOptional(input.address) } : {}),
        ...(input.projectName !== undefined ? { projectName: input.projectName.trim() } : {}),
        ...(input.projectType !== undefined ? { projectType: input.projectType.trim() } : {}),
        ...(input.technology !== undefined ? { technology: input.technology } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.notes !== undefined ? { notes: normalizeOptional(input.notes) } : {}),
        ...(input.projectDeadline ? { projectDeadline: new Date(input.projectDeadline) } : {}),
        totalCost,
        advancePaid,
        paidAmount: payments.paidAmount,
        remainingAmount: payments.remainingAmount
      }
    });

    return withMongoId(serializeNested(updated));
  },

  async remove(id: string) {
    try {
      const deleted = await prisma.customer.delete({ where: { id } });
      return withMongoId(serializeNested(deleted));
    } catch {
      return null;
    }
  },

  async findById(id: string) {
    await ensureCustomerSchema();
    const customer = await prisma.customer.findUnique({ where: { id } });
    return withMongoId(serializeNested(customer));
  },

  async removeMany(ids: string[]) {
    if (ids.length === 0) return { count: 0 };
    return prisma.customer.deleteMany({ where: { id: { in: ids } } });
  }
};

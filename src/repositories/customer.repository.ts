import { prisma } from "@/lib/prisma";
import { withMongoId, withMongoIds, serializeNested } from "@/lib/serialize";
import {
  calculateCustomerPayments,
  type CustomerCreateInput,
  type CustomerUpdateInput
} from "@/validators/customer.schema";

async function generateCustomerId() {
  const count = await prisma.customer.count();
  return `LC-${String(count + 1).padStart(5, "0")}`;
}

export const customerRepository = {
  async list(params: { page: number; limit: number; query?: string | null; status?: string | null; sort?: string }) {
    const where: Record<string, unknown> = {};
    if (params.status) where.status = params.status;
    if (params.query) {
      where.OR = [
        { name: { contains: params.query, mode: "insensitive" } },
        { email: { contains: params.query, mode: "insensitive" } },
        { company: { contains: params.query, mode: "insensitive" } },
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
    const payments = calculateCustomerPayments(input.totalCost, input.advancePaid ?? 0, input.paidAmount ?? 0);

    const created = await prisma.customer.create({
      data: {
        customerId: await generateCustomerId(),
        name: input.name,
        phone: input.phone,
        whatsapp: input.whatsapp,
        email: input.email.toLowerCase(),
        company: input.company,
        address: input.address,
        projectName: input.projectName,
        projectType: input.projectType,
        technology: input.technology ?? [],
        assignedManager: input.assignedManager,
        totalCost: input.totalCost,
        advancePaid: input.advancePaid ?? 0,
        paidAmount: payments.paidAmount,
        remainingAmount: payments.remainingAmount,
        projectDeadline: new Date(input.projectDeadline),
        priority: input.priority ?? "medium",
        status: input.status ?? "lead",
        notes: input.notes
      }
    });

    return withMongoId(serializeNested(created));
  },

  async update(id: string, input: CustomerUpdateInput) {
    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) return null;

    const totalCost = input.totalCost ?? existing.totalCost;
    const advancePaid = input.advancePaid ?? existing.advancePaid;
    const payments = calculateCustomerPayments(totalCost, advancePaid, input.paidAmount ?? existing.paidAmount);

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.whatsapp !== undefined ? { whatsapp: input.whatsapp } : {}),
        ...(input.email !== undefined ? { email: input.email.toLowerCase() } : {}),
        ...(input.company !== undefined ? { company: input.company } : {}),
        ...(input.address !== undefined ? { address: input.address } : {}),
        ...(input.projectName !== undefined ? { projectName: input.projectName } : {}),
        ...(input.projectType !== undefined ? { projectType: input.projectType } : {}),
        ...(input.technology !== undefined ? { technology: input.technology } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.projectDeadline
          ? { projectDeadline: new Date(input.projectDeadline) }
          : {}),
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
    const customer = await prisma.customer.findUnique({ where: { id } });
    return withMongoId(serializeNested(customer));
  },

  async removeMany(ids: string[]) {
    if (ids.length === 0) return { count: 0 };
    return prisma.customer.deleteMany({ where: { id: { in: ids } } });
  }
};

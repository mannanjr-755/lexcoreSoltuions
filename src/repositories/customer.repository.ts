import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { CustomerModel } from "@/models/Customer";
import {
  calculateCustomerPayments,
  type CustomerCreateInput,
  type CustomerUpdateInput
} from "@/validators/customer.schema";

async function generateCustomerId() {
  const count = await CustomerModel.countDocuments();
  return `LC-${String(count + 1).padStart(5, "0")}`;
}

export const customerRepository = {
  async list(params: { page: number; limit: number; query?: string | null; status?: string | null; sort?: string }) {
    await connectDb();
    const match: Record<string, unknown> = {};
    if (params.status) match.status = params.status;
    if (params.query) {
      match.$or = [
        { name: { $regex: params.query, $options: "i" } },
        { email: { $regex: params.query, $options: "i" } },
        { company: { $regex: params.query, $options: "i" } },
        { projectName: { $regex: params.query, $options: "i" } },
        { customerId: { $regex: params.query, $options: "i" } }
      ];
    }

    const sortField: Record<string, 1 | -1> = params.sort === "name" ? { name: 1 } : { createdAt: -1 };

    const [result] = await CustomerModel.aggregate([
      { $match: match },
      { $sort: sortField },
      {
        $facet: {
          data: [{ $skip: (params.page - 1) * params.limit }, { $limit: params.limit }],
          total: [{ $count: "count" }],
          financials: [
            {
              $group: {
                _id: null,
                totalRevenue: { $sum: "$totalCost" },
                totalReceived: { $sum: "$paidAmount" },
                totalPending: { $sum: "$remainingAmount" }
              }
            }
          ]
        }
      }
    ]);

    return {
      data: result?.data ?? [],
      total: result?.total?.[0]?.count ?? 0,
      financials: result?.financials?.[0] ?? { totalRevenue: 0, totalReceived: 0, totalPending: 0 }
    };
  },

  async findById(id: string) {
    await connectDb();
    return CustomerModel.findById(id);
  },

  async create(input: CustomerCreateInput & { assignedManager: string }) {
    await connectDb();
    const customerId = await generateCustomerId();
    const payments = calculateCustomerPayments(input.totalCost, input.advancePaid ?? 0, input.paidAmount ?? 0);

    return CustomerModel.create({
      ...input,
      technology: input.technology ?? [],
      priority: input.priority ?? "medium",
      status: input.status ?? "lead",
      customerId,
      projectDeadline: new Date(input.projectDeadline),
      paidAmount: payments.paidAmount,
      remainingAmount: payments.remainingAmount
    });
  },

  async update(id: string, input: CustomerUpdateInput) {
    await connectDb();
    const existing = await CustomerModel.findById(id);
    if (!existing) return null;

    const totalCost = input.totalCost ?? existing.totalCost;
    const advancePaid = input.advancePaid ?? existing.advancePaid ?? 0;
    const paidAmount = input.paidAmount ?? existing.paidAmount ?? 0;
    const payments = calculateCustomerPayments(totalCost, advancePaid, paidAmount);

    Object.assign(existing, input, {
      projectDeadline: input.projectDeadline ? new Date(input.projectDeadline) : existing.projectDeadline,
      paidAmount: payments.paidAmount,
      remainingAmount: payments.remainingAmount
    });
    await existing.save();
    return existing;
  },

  async remove(id: string) {
    await connectDb();
    if (!Types.ObjectId.isValid(id)) return null;
    const deleted = await CustomerModel.findByIdAndDelete(id);
    if (!deleted) return null;
    const stillThere = await CustomerModel.exists({ _id: id });
    if (stillThere) {
      throw new Error("Delete verification failed — customer still exists in MongoDB");
    }
    return deleted;
  },

  async removeMany(ids: string[]) {
    await connectDb();
    const validIds = ids.filter((id) => Types.ObjectId.isValid(id));
    if (validIds.length === 0) return { deletedCount: 0, acknowledged: true };
    const result = await CustomerModel.deleteMany({ _id: { $in: validIds } });
    const remaining = await CustomerModel.countDocuments({ _id: { $in: validIds } });
    if (remaining > 0) {
      throw new Error(`Delete verification failed — ${remaining} customer(s) still exist`);
    }
    return result;
  }
};

import { Schema, model, models, type Types, type InferSchemaType } from "mongoose";

const customerSchema = new Schema(
  {
    customerId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true, index: true },
    phone: { type: String, required: true, trim: true, index: true },
    whatsapp: { type: String, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, index: true },
    company: { type: String, trim: true, index: true },
    address: { type: String, trim: true },
    projectName: { type: String, required: true, trim: true },
    projectType: { type: String, required: true, trim: true, index: true },
    technology: [{ type: String, trim: true }],
    assignedManager: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    totalCost: { type: Number, required: true, min: 0 },
    advancePaid: { type: Number, default: 0, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    remainingAmount: { type: Number, required: true, min: 0 },
    projectDeadline: { type: Date, required: true, index: true },
    priority: { type: String, enum: ["low", "medium", "high", "urgent"], default: "medium", index: true },
    status: { type: String, enum: ["lead", "active", "on_hold", "completed", "cancelled"], default: "lead", index: true },
    notes: { type: String, trim: true },
    documents: [{ type: String }]
  },
  { timestamps: true }
);

customerSchema.index({ status: 1, projectDeadline: 1 });
customerSchema.index({ assignedManager: 1, status: 1 });
customerSchema.index({ name: "text", email: "text", company: "text", projectName: "text" });

export type CustomerDocument = InferSchemaType<typeof customerSchema> & { _id: Types.ObjectId };
export const CustomerModel = models.Customer || model("Customer", customerSchema);

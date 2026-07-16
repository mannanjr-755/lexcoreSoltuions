import { Schema, model, models, type Types, type InferSchemaType } from "mongoose";

const paymentSchema = new Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project" },
    amount: { type: Number, required: true, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    grandTotal: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["pending", "paid", "partial", "overdue", "cancelled"], default: "pending", index: true },
    paymentMethod: { type: String, enum: ["cash", "bank", "card", "online"], default: "bank" },
    paidAt: { type: Date },
    dueDate: { type: Date, required: true, index: true },
    notes: { type: String },
    isArchived: { type: Boolean, default: false, index: true }
  },
  { timestamps: true }
);

export type PaymentDocument = InferSchemaType<typeof paymentSchema> & { _id: Types.ObjectId };
export const PaymentModel = models.Payment || model("Payment", paymentSchema);

import { Schema, model, models, type Types, type InferSchemaType } from "mongoose";

const quotationSchema = new Schema(
  {
    quotationNumber: { type: String, required: true, unique: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    title: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    grandTotal: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["draft", "sent", "accepted", "rejected", "expired"],
      default: "draft",
      index: true
    },
    validUntil: { type: Date, required: true },
    notes: { type: String },
    isArchived: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export type QuotationDocument = InferSchemaType<typeof quotationSchema> & { _id: Types.ObjectId };
export const QuotationModel = models.Quotation || model("Quotation", quotationSchema);

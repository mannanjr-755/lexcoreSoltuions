import { Schema, model, models, type Types, type InferSchemaType } from "mongoose";

const expenseSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ["office", "marketing", "hosting", "software", "electricity", "internet", "transport", "miscellaneous"],
      required: true,
      index: true
    },
    amount: { type: Number, required: true, min: 0 },
    description: { type: String, trim: true },
    date: { type: Date, required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    isArchived: { type: Boolean, default: false, index: true }
  },
  { timestamps: true }
);

expenseSchema.index({ date: -1, category: 1 });

export type ExpenseDocument = InferSchemaType<typeof expenseSchema> & { _id: Types.ObjectId };
export const ExpenseModel = models.Expense || model("Expense", expenseSchema);

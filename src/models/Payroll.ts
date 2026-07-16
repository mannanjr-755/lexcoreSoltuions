import { Schema, model, models, type Types, type InferSchemaType } from "mongoose";

const payrollSchema = new Schema(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true, index: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    basicSalary: { type: Number, required: true, min: 0 },
    allowances: { type: Number, default: 0, min: 0 },
    deductions: { type: Number, default: 0, min: 0 },
    netSalary: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["draft", "processed", "paid"], default: "draft", index: true },
    paidAt: { type: Date },
    notes: { type: String }
  },
  { timestamps: true }
);

payrollSchema.index({ employeeId: 1, month: 1, year: 1 }, { unique: true });

export type PayrollDocument = InferSchemaType<typeof payrollSchema> & { _id: Types.ObjectId };
export const PayrollModel = models.Payroll || model("Payroll", payrollSchema);

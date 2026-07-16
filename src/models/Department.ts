import { Schema, model, models, type Types, type InferSchemaType } from "mongoose";

const departmentSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true, index: true },
    code: { type: String, trim: true, uppercase: true, index: true, default: "" },
    description: { type: String, trim: true, default: "" },
    managerName: { type: String, trim: true, default: "" },
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    employeeCount: { type: Number, default: 0, min: 0 },
    isArchived: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export type DepartmentDocument = InferSchemaType<typeof departmentSchema> & { _id: Types.ObjectId };
export const DepartmentModel = models.Department || model("Department", departmentSchema);

import { Schema, model, models, type Types, type InferSchemaType } from "mongoose";

const employeeSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    employeeId: { type: String, required: true, unique: true, index: true },
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    cnic: { type: String, trim: true },
    department: { type: String, required: true, index: true },
    position: { type: String, required: true },
    salary: { type: Number, default: 0, min: 0 },
    photo: { type: String },
    status: { type: String, enum: ["active", "inactive", "on_leave"], default: "active", index: true },
    joinDate: { type: Date, default: Date.now },
    attendancePercentage: { type: Number, default: 100, min: 0, max: 100 },
    isArchived: { type: Boolean, default: false, index: true }
  },
  { timestamps: true }
);

export type EmployeeDocument = InferSchemaType<typeof employeeSchema> & { _id: Types.ObjectId };
export const EmployeeModel = models.Employee || model("Employee", employeeSchema);

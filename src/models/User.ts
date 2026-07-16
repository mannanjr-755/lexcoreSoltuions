import { Schema, model, models, type InferSchemaType } from "mongoose";
import { ROLES } from "@/types/auth";

const userSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ROLES, default: "employee", index: true },
    phone: { type: String, trim: true },
    profilePhoto: { type: String },
    company: { type: String, default: "Lexcore Solutions", trim: true },
    designation: { type: String, default: "Super Admin", trim: true },
    address: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    lastLoginIp: { type: String },
    otpCode: { type: String },
    otpExpiresAt: { type: Date },
    otpVerified: { type: Boolean, default: false },
    passwordResetToken: { type: String },
    passwordResetExpires: { type: Date }
  },
  { timestamps: true }
);

userSchema.index({ role: 1, createdAt: -1 });

export type UserDocument = InferSchemaType<typeof userSchema>;
export const UserModel = models.User || model("User", userSchema);

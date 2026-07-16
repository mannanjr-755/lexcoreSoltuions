import { Schema, model, models, type InferSchemaType } from "mongoose";

const loginHistorySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    ipAddress: { type: String, required: true },
    userAgent: { type: String, required: true },
    browser: { type: String },
    success: { type: Boolean, required: true, index: true },
    failureReason: { type: String }
  },
  { timestamps: true }
);

loginHistorySchema.index({ userId: 1, createdAt: -1 });

export type LoginHistoryDocument = InferSchemaType<typeof loginHistorySchema>;
export const LoginHistoryModel = models.LoginHistory || model("LoginHistory", loginHistorySchema);

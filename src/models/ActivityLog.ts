import { Schema, model, models, type InferSchemaType } from "mongoose";

const activityLogSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    userName: { type: String, required: true },
    action: { type: String, required: true, index: true },
    entity: { type: String, index: true },
    entityId: { type: String },
    description: { type: String, required: true },
    ipAddress: { type: String },
    userAgent: { type: String },
    browser: { type: String },
    metadata: { type: Schema.Types.Mixed }
  },
  { timestamps: true }
);

activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ userId: 1, createdAt: -1 });

export type ActivityLogDocument = InferSchemaType<typeof activityLogSchema>;
export const ActivityLogModel = models.ActivityLog || model("ActivityLog", activityLogSchema);

import { Schema, model, models, type Types, type InferSchemaType } from "mongoose";

const documentSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, index: true },
    category: {
      type: String,
      enum: ["contract", "invoice", "proposal", "policy", "other"],
      default: "other",
      index: true
    },
    fileUrl: { type: String, required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", index: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", index: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User" },
    notes: { type: String },
    isArchived: { type: Boolean, default: false, index: true }
  },
  { timestamps: true }
);

export type DocumentRecord = InferSchemaType<typeof documentSchema> & { _id: Types.ObjectId };
export const DocumentModel = models.Document || model("Document", documentSchema);

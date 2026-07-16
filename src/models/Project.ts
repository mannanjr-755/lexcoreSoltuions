import { Schema, model, models, type Types, type InferSchemaType } from "mongoose";

const projectSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    description: { type: String, trim: true },
    status: {
      type: String,
      enum: ["pending", "active", "on_hold", "completed", "cancelled"],
      default: "pending",
      index: true
    },
    priority: { type: String, enum: ["low", "medium", "high", "urgent"], default: "medium" },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    totalTasks: { type: Number, default: 0 },
    completedTasks: { type: Number, default: 0 },
    budget: { type: Number, default: 0, min: 0 },
    spent: { type: Number, default: 0, min: 0 },
    teamLeader: { type: Schema.Types.ObjectId, ref: "User" },
    assignedEmployees: [{ type: Schema.Types.ObjectId, ref: "User" }],
    deadline: { type: Date, required: true, index: true },
    technologies: [{ type: String }],
    isArchived: { type: Boolean, default: false, index: true }
  },
  { timestamps: true }
);

projectSchema.index({ status: 1, deadline: 1 });

export type ProjectDocument = InferSchemaType<typeof projectSchema> & { _id: Types.ObjectId };
export const ProjectModel = models.Project || model("Project", projectSchema);

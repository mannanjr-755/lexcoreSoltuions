import { Schema, model, models, type Types, type InferSchemaType } from "mongoose";

const taskSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, index: true },
    description: { type: String, trim: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", index: true },
    assigneeId: { type: Schema.Types.ObjectId, ref: "Employee", index: true },
    status: {
      type: String,
      enum: ["todo", "in_progress", "review", "done", "cancelled"],
      default: "todo",
      index: true
    },
    priority: { type: String, enum: ["low", "medium", "high", "urgent"], default: "medium" },
    dueDate: { type: Date, index: true },
    isArchived: { type: Boolean, default: false, index: true }
  },
  { timestamps: true }
);

export type TaskDocument = InferSchemaType<typeof taskSchema> & { _id: Types.ObjectId };
export const TaskModel = models.Task || model("Task", taskSchema);

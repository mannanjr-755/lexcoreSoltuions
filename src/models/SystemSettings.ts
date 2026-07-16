import { Schema, model, models, type InferSchemaType } from "mongoose";
import { connectDb } from "@/lib/db";

const systemSettingsSchema = new Schema(
  {
    companyName: { type: String, default: "Lexcore Solutions" },
    companyLogo: { type: String },
    companyAddress: { type: String },
    companyEmail: { type: String },
    companyPhone: { type: String },
    companyWebsite: { type: String, default: "https://lexcore.com" },
    smtpHost: { type: String },
    smtpPort: { type: Number, default: 587 },
    smtpUser: { type: String },
    smtpPass: { type: String },
    smtpFrom: { type: String },
    currency: { type: String, default: "USD" },
    timezone: { type: String, default: "UTC" },
    language: { type: String, default: "en" },
    theme: { type: String, enum: ["dark", "light"], default: "dark" },
    backupEnabled: { type: Boolean, default: false },
    backupSchedule: { type: String, default: "0 2 * * *" },
    sessionTimeoutMinutes: { type: Number, default: 30 },
    maxLoginAttempts: { type: Number, default: 5 },
    lockoutDurationMinutes: { type: Number, default: 30 },
    dashboardLayout: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

export type SystemSettingsDocument = InferSchemaType<typeof systemSettingsSchema>;
export const SystemSettingsModel = models.SystemSettings || model("SystemSettings", systemSettingsSchema);

export async function getSystemSettings() {
  await connectDb();
  let settings = await SystemSettingsModel.findOne();
  if (!settings) {
    settings = await SystemSettingsModel.create({});
  }
  return settings;
}

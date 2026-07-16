import { Schema, model, models, type Types, type InferSchemaType } from "mongoose";

const attendanceSchema = new Schema(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true, index: true },
    employeeName: { type: String, required: true, trim: true, index: true },
    department: { type: String, trim: true, index: true, default: "" },
    date: { type: Date, required: true, index: true },
    dateKey: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ["present", "absent", "late", "half_day", "leave", "work_from_home"],
      default: "present",
      index: true
    },
    checkIn: { type: String, default: "" },
    checkOut: { type: String, default: "" },
    workingHours: { type: Number, default: 0, min: 0 },
    remarks: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true, default: "" }
  },
  { timestamps: true }
);

attendanceSchema.index({ employeeId: 1, dateKey: 1 }, { unique: true });

export type AttendanceDocument = InferSchemaType<typeof attendanceSchema> & { _id: Types.ObjectId };

// Re-register in dev so schema changes (dateKey, remarks, etc.) always apply
if (models.Attendance) {
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  delete models.Attendance;
}

export const AttendanceModel = model("Attendance", attendanceSchema);

export function toDateKey(date: Date | string) {
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }
  const d = typeof date === "string" ? new Date(date) : date;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse YYYY-MM-DD as a local calendar date (avoids UTC shift bugs). */
export function parseDateOnly(value: string | Date) {
  if (value instanceof Date) {
    const d = new Date(value);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function calcWorkingHours(checkIn?: string, checkOut?: string) {
  if (!checkIn || !checkOut) return 0;
  const [ih, im] = checkIn.split(":").map(Number);
  const [oh, om] = checkOut.split(":").map(Number);
  if ([ih, im, oh, om].some((n) => Number.isNaN(n))) return 0;
  const mins = oh * 60 + om - (ih * 60 + im);
  return mins > 0 ? Math.round((mins / 60) * 100) / 100 : 0;
}

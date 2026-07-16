import nodemailer from "nodemailer";
import { getEnv } from "@/lib/env";
import { getSystemSettings } from "@/services/settings.service";

async function createTransporter() {
  const settings = await getSystemSettings();
  const env = getEnv();

  const host = settings.smtpHost || env.SMTP_HOST;
  const port = settings.smtpPort || env.SMTP_PORT || 587;
  const user = settings.smtpUser || env.SMTP_USER;
  const pass = settings.smtpPass || env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error("SMTP is not configured. Set SMTP settings in environment or System Settings.");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });
}

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const settings = await getSystemSettings();
  const env = getEnv();
  const from = settings.smtpFrom || env.SMTP_FROM || settings.companyEmail || "noreply@lexcore.com";

  const transporter = await createTransporter();
  await transporter.sendMail({ from, to, subject, html });
}

export async function sendOtpEmail(to: string, otp: string, name: string) {
  const html = `
    <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #09090B; color: #fff; border-radius: 16px;">
      <h1 style="color: #F4B400; margin-bottom: 8px;">Lexcore Solutions</h1>
      <p>Hello ${name},</p>
      <p>Your password reset OTP code is:</p>
      <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #F4B400; margin: 24px 0;">${otp}</div>
      <p style="color: #9CA3AF;">This code expires in 15 minutes. If you did not request this, ignore this email.</p>
    </div>
  `;
  await sendEmail({ to, subject: "Lexcore ERP - Password Reset OTP", html });
}

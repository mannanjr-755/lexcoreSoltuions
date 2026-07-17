import jwt, { type SignOptions } from "jsonwebtoken";
import { assertAuthEnv } from "@/lib/database-url";
import type { JwtPayload } from "@/types/auth";

const DEFAULT_ACCESS_EXPIRY: SignOptions["expiresIn"] = "1d";
const DEFAULT_REFRESH_EXPIRY: SignOptions["expiresIn"] = "7d";
const REMEMBER_ACCESS_EXPIRY: SignOptions["expiresIn"] = "7d";
const REMEMBER_REFRESH_EXPIRY: SignOptions["expiresIn"] = "30d";

export function signAccessToken(payload: JwtPayload, rememberMe = false) {
  const { accessSecret } = assertAuthEnv();
  const options: SignOptions = {
    expiresIn: rememberMe ? REMEMBER_ACCESS_EXPIRY : DEFAULT_ACCESS_EXPIRY
  };
  return jwt.sign(payload, accessSecret, options);
}

export function signRefreshToken(payload: JwtPayload, rememberMe = false) {
  const { refreshSecret } = assertAuthEnv();
  const options: SignOptions = {
    expiresIn: rememberMe ? REMEMBER_REFRESH_EXPIRY : DEFAULT_REFRESH_EXPIRY
  };
  return jwt.sign(payload, refreshSecret, options);
}

export function verifyAccessToken(token: string) {
  const { accessSecret } = assertAuthEnv();
  return jwt.verify(token, accessSecret) as JwtPayload;
}

export function verifyRefreshToken(token: string) {
  const { refreshSecret } = assertAuthEnv();
  return jwt.verify(token, refreshSecret) as JwtPayload;
}

export function signOtpToken(email: string, otp: string) {
  const { accessSecret } = assertAuthEnv();
  const otpSecret = process.env.JWT_OTP_SECRET?.trim() || accessSecret;
  return jwt.sign({ email, otp, purpose: "password_reset" }, otpSecret, { expiresIn: "15m" });
}

export function verifyOtpToken(token: string) {
  const { accessSecret } = assertAuthEnv();
  const otpSecret = process.env.JWT_OTP_SECRET?.trim() || accessSecret;
  return jwt.verify(token, otpSecret) as { email: string; otp: string; purpose: string };
}

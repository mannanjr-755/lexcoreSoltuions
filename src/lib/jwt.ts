import jwt, { type SignOptions } from "jsonwebtoken";
import { getEnv } from "@/lib/env";
import type { JwtPayload } from "@/types/auth";

const DEFAULT_ACCESS_EXPIRY: SignOptions["expiresIn"] = "1d";
const DEFAULT_REFRESH_EXPIRY: SignOptions["expiresIn"] = "7d";
const REMEMBER_ACCESS_EXPIRY: SignOptions["expiresIn"] = "7d";
const REMEMBER_REFRESH_EXPIRY: SignOptions["expiresIn"] = "30d";

export function signAccessToken(payload: JwtPayload, rememberMe = false) {
  const env = getEnv();
  const options: SignOptions = {
    expiresIn: rememberMe ? REMEMBER_ACCESS_EXPIRY : DEFAULT_ACCESS_EXPIRY
  };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, options);
}

export function signRefreshToken(payload: JwtPayload, rememberMe = false) {
  const env = getEnv();
  const options: SignOptions = {
    expiresIn: rememberMe ? REMEMBER_REFRESH_EXPIRY : DEFAULT_REFRESH_EXPIRY
  };
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, options);
}

export function verifyAccessToken(token: string) {
  const env = getEnv();
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string) {
  const env = getEnv();
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;
}

export function signOtpToken(email: string, otp: string) {
  const env = getEnv();
  const secret = env.JWT_OTP_SECRET ?? env.JWT_ACCESS_SECRET;
  return jwt.sign({ email, otp, purpose: "password_reset" }, secret, { expiresIn: "15m" });
}

export function verifyOtpToken(token: string) {
  const env = getEnv();
  const secret = env.JWT_OTP_SECRET ?? env.JWT_ACCESS_SECRET;
  return jwt.verify(token, secret) as { email: string; otp: string; purpose: string };
}

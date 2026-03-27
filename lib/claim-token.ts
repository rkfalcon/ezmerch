import { randomBytes } from "crypto";

export function generateClaimToken(): string {
  // 256-bit (32-byte) cryptographically random token, base64url-encoded
  return randomBytes(32).toString("base64url");
}

export function getClaimTokenExpiry(): Date {
  // 7-day TTL
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 7);
  return expiry;
}

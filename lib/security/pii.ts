import crypto from "node:crypto";
import { env } from "@/lib/env";

const VERSION = "v1";

function keyFromHex(name: "PII_ENC_KEY" | "PII_HMAC_KEY"): Buffer {
  const value = env()[name];
  if (!value || !/^[0-9a-f]{64}$/i.test(value)) {
    throw new Error(`${name} must be a 32-byte hex string`);
  }
  return Buffer.from(value, "hex");
}

export function normalizeRrnFront(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return /^\d{6}$/.test(digits) ? digits : null;
}

export function normalizeRrnBack(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return /^\d{7}$/.test(digits) ? digits : null;
}

export function piiHash(value: string | null | undefined): string | null {
  if (!value) return null;
  return crypto.createHmac("sha256", keyFromHex("PII_HMAC_KEY")).update(value).digest("hex");
}

export function encryptPii(value: string | null | undefined): string | null {
  if (!value) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", keyFromHex("PII_ENC_KEY"), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

export function decryptPii(value: string | null | undefined): string | null {
  if (!value) return null;
  const [version, ivRaw, tagRaw, encryptedRaw] = value.split(":");
  if (version !== VERSION || !ivRaw || !tagRaw || !encryptedRaw) return null;

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    keyFromHex("PII_ENC_KEY"),
    Buffer.from(ivRaw, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function encodeRrnFields(input: {
  rrnFront?: string | null;
  rrnBack?: string | null;
}): {
  rrnFrontHash: string | null;
  rrnBackHash: string | null;
  rrnBackEnc: string | null;
} {
  const rrnFront = normalizeRrnFront(input.rrnFront);
  const rrnBack = normalizeRrnBack(input.rrnBack);
  return {
    rrnFrontHash: piiHash(rrnFront),
    rrnBackHash: piiHash(rrnBack),
    rrnBackEnc: encryptPii(rrnBack),
  };
}

export function encodeRrnBackFields(value: string | null | undefined): {
  rrnBackHash: string | null;
  rrnBackEnc: string | null;
} {
  const rrnBack = normalizeRrnBack(value);
  return {
    rrnBackHash: piiHash(rrnBack),
    rrnBackEnc: encryptPii(rrnBack),
  };
}

export function encodeRrnFrontFields(value: string | null | undefined): {
  rrnFrontHash: string | null;
} {
  const rrnFront = normalizeRrnFront(value);
  return {
    rrnFrontHash: piiHash(rrnFront),
  };
}

export function getStoredRrnFrontHash(row: {
  rrnFrontHash?: string | null;
}): string | null {
  return row.rrnFrontHash ?? null;
}

export function getStoredRrnBackHash(row: {
  rrnBackHash?: string | null;
}): string | null {
  return row.rrnBackHash ?? null;
}

export function getStoredRrnBack(row: {
  rrnBackEnc?: string | null;
}): string | null {
  if (row.rrnBackEnc) return decryptPii(row.rrnBackEnc);
  return null;
}

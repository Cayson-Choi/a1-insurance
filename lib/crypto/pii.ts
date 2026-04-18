import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { env } from "@/lib/env";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function encKey(): Buffer {
  const hex = env().PII_ENC_KEY;
  const buf = Buffer.from(hex, "hex");
  if (buf.length !== 32) throw new Error("PII_ENC_KEY must decode to 32 bytes");
  return buf;
}

function hmacKey(): Buffer {
  const hex = env().PII_HMAC_KEY;
  const buf = Buffer.from(hex, "hex");
  if (buf.length !== 32) throw new Error("PII_HMAC_KEY must decode to 32 bytes");
  return buf;
}

/**
 * AES-256-GCM 암호화. 결과 포맷: [iv(12)][authTag(16)][ciphertext].
 * DB bytea 컬럼에 Buffer로 저장한다.
 */
export function encryptPII(plain: string): Buffer {
  if (!plain) throw new Error("encryptPII: empty plaintext");
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, encKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]);
}

export function decryptPII(enc: Buffer | null | undefined): string | null {
  if (!enc || enc.length < IV_LEN + TAG_LEN) return null;
  const iv = enc.subarray(0, IV_LEN);
  const tag = enc.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = enc.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, encKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

/**
 * 주민번호 검색용 결정적 해시. 같은 평문 → 같은 hex 64자.
 * HMAC-SHA256(키 = PII_HMAC_KEY).
 */
export function hashPII(plain: string): string {
  return createHmac("sha256", hmacKey()).update(plain).digest("hex");
}

export function verifyHashPII(plain: string, expectedHex: string): boolean {
  const got = Buffer.from(hashPII(plain), "hex");
  const want = Buffer.from(expectedHex, "hex");
  if (got.length !== want.length) return false;
  return timingSafeEqual(got, want);
}

/**
 * 주민번호 표시 마스킹. 기본적으로는 뒷자리 첫 글자 외에는 모두 가린다.
 *   "901201" + "1234567"  →  "901201-1******"
 *   "901201" + null       →  "901201-*******"
 *   null + "1234567"      →  "******-1******"
 */
export function maskRrn(
  front: string | null | undefined,
  back: string | null | undefined,
): string {
  const f = front && front.trim() ? front.trim() : "******";
  if (!back) return `${f}-*******`;
  const b = back.trim();
  if (!b) return `${f}-*******`;
  return `${f}-${b[0]}******`;
}

export function isValidRrnFront(s: string): boolean {
  return /^\d{6}$/.test(s);
}
export function isValidRrnBack(s: string): boolean {
  return /^\d{7}$/.test(s);
}

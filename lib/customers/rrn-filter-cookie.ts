export const RRN_FILTER_COOKIE = "dbcrm_rrn_filter";

const HASH_RE = /^[0-9a-f]{64}$/i;

export type StoredRrnFilter = {
  rrnFrontHash?: string;
  rrnBackHash?: string;
};

export function encodeRrnFilterCookie(value: StoredRrnFilter): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function parseRrnFilterCookie(value: string | undefined): StoredRrnFilter {
  if (!value) return {};
  try {
    const raw = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as StoredRrnFilter;
    return {
      rrnFrontHash: HASH_RE.test(raw.rrnFrontHash ?? "") ? raw.rrnFrontHash : undefined,
      rrnBackHash: HASH_RE.test(raw.rrnBackHash ?? "") ? raw.rrnBackHash : undefined,
    };
  } catch {
    return {};
  }
}

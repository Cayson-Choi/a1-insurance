import { NextRequest, NextResponse } from "next/server";

type Bucket = {
  count: number;
  resetAt: number;
};

const store = globalThis as typeof globalThis & {
  __dbCrmRateLimit?: Map<string, Bucket>;
};

function buckets(): Map<string, Bucket> {
  if (!store.__dbCrmRateLimit) store.__dbCrmRateLimit = new Map();
  return store.__dbCrmRateLimit;
}

export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") ?? "unknown";
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: true } | { ok: false; resetAt: number } {
  const now = Date.now();
  const map = buckets();
  const current = map.get(key);

  if (!current || current.resetAt <= now) {
    map.set(key, { count: 1, resetAt: now + windowMs });
    cleanup(now);
    return { ok: true };
  }

  if (current.count >= limit) {
    return { ok: false, resetAt: current.resetAt };
  }

  current.count += 1;
  return { ok: true };
}

export function rateLimitKey(scope: string, agentId: string, req: NextRequest): string {
  return `${scope}:${agentId}:${getClientIp(req)}`;
}

export function isSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === req.nextUrl.origin;
  } catch {
    return false;
  }
}

export function apiSecurityHeaders(res: Response | NextResponse): Response | NextResponse {
  res.headers.set("Cache-Control", "no-store, max-age=0");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "same-origin");
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export function tooManyRequests(resetAt: number): Response {
  const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  const res = NextResponse.json(
    { ok: false, error: "요청이 너무 많습니다. 잠시 후 다시 시도하세요." },
    { status: 429 },
  );
  res.headers.set("Retry-After", String(retryAfter));
  return apiSecurityHeaders(res) as Response;
}

function cleanup(now: number) {
  const map = buckets();
  if (map.size < 500) return;
  for (const [key, bucket] of map) {
    if (bucket.resetAt <= now) map.delete(key);
  }
}

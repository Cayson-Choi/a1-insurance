import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/rbac";
import { normalizeRrnBack, normalizeRrnFront, piiHash } from "@/lib/security/pii";
import {
  apiSecurityHeaders,
  isSameOrigin,
  rateLimit,
  rateLimitKey,
  tooManyRequests,
} from "@/lib/security/rate-limit";
import {
  RRN_FILTER_COOKIE,
  encodeRrnFilterCookie,
  type StoredRrnFilter,
} from "@/lib/customers/rrn-filter-cookie";

export const runtime = "nodejs";

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const res = NextResponse.json(body, init);
  return apiSecurityHeaders(res) as NextResponse;
}

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!isSameOrigin(req)) {
    return jsonNoStore({ ok: false, error: "허용되지 않은 요청 출처입니다." }, { status: 403 });
  }

  const limited = rateLimit(rateLimitKey("customers-rrn-filter", user.agentId, req), 60, 60_000);
  if (!limited.ok) return tooManyRequests(limited.resetAt);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const input = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const rrnFront = normalizeRrnFront(typeof input.rrnFront === "string" ? input.rrnFront : "");
  const rrnBack = normalizeRrnBack(typeof input.rrnBack === "string" ? input.rrnBack : "");

  const filter: StoredRrnFilter = {
    rrnFrontHash: rrnFront ? piiHash(rrnFront) ?? undefined : undefined,
    rrnBackHash: rrnBack ? piiHash(rrnBack) ?? undefined : undefined,
  };

  const res = jsonNoStore({ ok: true });
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/customers",
  };

  if (!filter.rrnFrontHash && !filter.rrnBackHash) {
    res.cookies.set(RRN_FILTER_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  } else {
    res.cookies.set(RRN_FILTER_COOKIE, encodeRrnFilterCookie(filter), {
      ...cookieOptions,
      maxAge: 30 * 60,
    });
  }

  return res;
}

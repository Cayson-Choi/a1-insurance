// 고객 모달의 prev/next 네비게이션을 위한 GET API.
// 기존엔 server action(fetchCustomerAction)으로 처리했으나 server action 의 auto-revalidation
// 부작용으로 URL/cache state 가 망가지는 문제가 있어 일반 API route 로 전환.
// 일반 fetch 라서 auto-revalidate 안 일어나고 빠르게 응답 가능.

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/rbac";
import { getCustomerDetail, getDetailContext } from "@/lib/customers/get-detail";
import { isUuid } from "@/lib/security/ids";
import {
  apiSecurityHeaders,
  rateLimit,
  rateLimitKey,
  tooManyRequests,
} from "@/lib/security/rate-limit";

export const runtime = "nodejs";

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const res = NextResponse.json(body, init);
  return apiSecurityHeaders(res) as NextResponse;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const limited = rateLimit(rateLimitKey("customer-context", user.agentId, req), 180, 60_000);
  if (!limited.ok) return tooManyRequests(limited.resetAt);

  const { id } = await params;
  if (!isUuid(id)) {
    return jsonNoStore(
      { ok: false, error: "Customer not found." },
      { status: 404 },
    );
  }

  const sp: Record<string, string> = {};
  req.nextUrl.searchParams.forEach((v, k) => {
    sp[k] = v;
  });

  const [customer, context] = await Promise.all([
    getCustomerDetail(id, user),
    getDetailContext(id, sp, user),
  ]);
  if (!customer) {
    return jsonNoStore(
      { ok: false, error: "고객을 찾을 수 없습니다." },
      { status: 404 },
    );
  }
  return jsonNoStore({ ok: true, customer, context });
}

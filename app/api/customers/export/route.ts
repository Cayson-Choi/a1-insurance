import { NextRequest } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { customers, users, auditLogs } from "@/lib/db/schema";
import { requireUser, getPermissions } from "@/lib/auth/rbac";
import { parseFilter, buildWhere } from "@/lib/customers/queries";
import { buildCustomersWorkbook, type ExportRow } from "@/lib/excel/exporter";
import { getStoredRrnBack } from "@/lib/security/pii";
import {
  apiSecurityHeaders,
  isSameOrigin,
  rateLimit,
  rateLimitKey,
  tooManyRequests,
} from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_EXPORT_ROWS = 50_000;

export async function GET(req: NextRequest) {
  const user = await requireUser();
  // CSRF 방어: 외부 사이트에서 <a href="...export"> 으로 유도해도 Origin 체크로 거부.
  if (!isSameOrigin(req)) {
    return apiSecurityHeaders(new Response("허용되지 않은 요청 출처입니다.", {
      status: 403,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    }));
  }
  const limited = rateLimit(rateLimitKey("customers-export", user.agentId, req), 12, 60_000);
  if (!limited.ok) return tooManyRequests(limited.resetAt);

  const perms = await getPermissions(user.agentId);
  if (!perms?.canExport) {
    return apiSecurityHeaders(new Response("엑셀 다운로드 권한이 없습니다.", {
      status: 403,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    }));
  }

  const sp: Record<string, string> = {};
  req.nextUrl.searchParams.forEach((v, k) => {
    if (sp[k] === undefined) sp[k] = v;
  });
  const filter = parseFilter(sp);

  // RBAC 스코프 적용 — agent 는 본인 담당분만, manager·admin 은 전체.
  // 자체 conds[] 를 만들면 권한 WHERE 가 빠져 agent 가 canExport 만으로 전체 데이터를 받을 수 있음.
  const where = buildWhere(filter, user);

  const rows = await db
    .select({
      customerCode: customers.customerCode,
      agentId: customers.agentId,
      name: customers.name,
      birthDate: customers.birthDate,
      rrnBackEnc: customers.rrnBackEnc,
      phone1: customers.phone1,
      job: customers.job,
      address: customers.address,
      addressDetail: customers.addressDetail,
      callResult: customers.callResult,
      dbProduct: customers.dbProduct,
      dbPremium: customers.dbPremium,
      dbHandler: customers.dbHandler,
      subCategory: customers.subCategory,
      dbPolicyNo: customers.dbPolicyNo,
      dbRegisteredAt: customers.dbRegisteredAt,
      mainCategory: customers.mainCategory,
      dbStartAt: customers.dbStartAt,
      dbEndAt: customers.dbEndAt,
      branch: customers.branch,
      hq: customers.hq,
      team: customers.team,
      fax: customers.fax,
      reservationReceived: customers.reservationReceived,
      createdAt: customers.createdAt,
      updatedAt: customers.updatedAt,
      dbCompany: customers.dbCompany,
      agentName: users.name,
    })
    .from(customers)
    .leftJoin(users, eq(customers.agentId, users.agentId))
    .where(where ?? sql`true`)
    .orderBy(desc(customers.dbRegisteredAt), desc(customers.createdAt))
    .limit(MAX_EXPORT_ROWS + 1);

  if (rows.length > MAX_EXPORT_ROWS) {
    const res = new Response(
      `엑셀 다운로드는 최대 ${MAX_EXPORT_ROWS.toLocaleString("ko-KR")}건까지 가능합니다. 검색 조건을 좁혀주세요.`,
      {
        status: 413,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      },
    );
    return apiSecurityHeaders(res);
  }

  const exportRows: ExportRow[] = rows.map((r) => ({
    ...r,
    rrnFront: null,
    rrnBack: getStoredRrnBack(r),
    agentName: r.agentName,
  }));

  // 감사 로그: PII 복호화 포함 대량 다운로드 — 누가 언제 몇 건 내려받았는지 기록.
  try {
    await db.insert(auditLogs).values({
      actorAgentId: user.agentId,
      customerId: null,
      action: "import", // export 전용 action 없으므로 import 재활용 (audit_action enum 확장 시 변경)
      before: null,
      after: {
        type: "export",
        rows: exportRows.length,
        hasRrnBack: exportRows.some((r) => r.rrnBack !== null),
        filters: sp,
      },
    });
  } catch (e) {
    console.warn("[export] audit insert failed:", e);
  }

  const wb = await buildCustomersWorkbook(exportRows);
  const buffer = await wb.xlsx.writeBuffer();

  const now = new Date();
  const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
  const filename = `DB-CRM_고객명부_${ts}.xlsx`;

  return apiSecurityHeaders(new Response(buffer as ArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  }));
}

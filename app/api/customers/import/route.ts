import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { customers, users } from "@/lib/db/schema";
import { requireUser, getPermissions } from "@/lib/auth/rbac";
import { parseCustomersWorkbook } from "@/lib/excel/importer";
import { birthDateToFrontYymmdd, extractRrnBackRaw } from "@/lib/excel/column-map";
import type { Customer, NewCustomer } from "@/lib/db/schema";

// UPDATE 경로에서 "실제 변경 여부" 를 판정할 때 비교할 필드 목록.
// createdAt / updatedAt / id 는 제외 — 이들은 의미적 타임스탬프이므로 비교 대상이 아님.
const DIFF_KEYS = [
  "customerCode",
  "agentId",
  "name",
  "birthDate",
  "rrnFront",
  "rrnBack",
  "phone1",
  "job",
  "address",
  "addressDetail",
  "callResult",
  "dbProduct",
  "dbPremium",
  "dbHandler",
  "subCategory",
  "dbPolicyNo",
  "dbRegisteredAt",
  "mainCategory",
  "dbStartAt",
  "dbEndAt",
  "branch",
  "hq",
  "team",
  "fax",
  "reservationReceived",
  "dbCompany",
] as const satisfies readonly (keyof Customer)[];

/** 문자열로 정규화. 필드별 특수 케이스: 숫자 컬럼은 수치 비교로 소수점 여유("55000" vs "55000.00") 흡수. */
function normalize(v: unknown, key?: string): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString();
  const s = String(v).trim();
  // dbPremium: PostgreSQL numeric 은 "55000.00" 반환, 엑셀 파싱은 "55000" — 숫자 비교로 정렬
  if (key === "dbPremium") {
    const n = Number(s.replace(/,/g, ""));
    return Number.isFinite(n) ? n.toString() : s;
  }
  return s;
}

function hasChanges(existing: Customer, incoming: Partial<NewCustomer>): boolean {
  const inc = incoming as Record<string, unknown>;
  for (const k of DIFF_KEYS) {
    // 엑셀이 이 필드를 제공하지 않으면(undefined) 비교에서 제외 — drizzle .set() 도 undefined 필드는 SET 에서 빠뜨려 DB 기존 값 유지. 비교도 동일하게 처리해야 왕복 일관성 보장.
    if (inc[k] === undefined) continue;
    if (normalize(existing[k], k) !== normalize(inc[k], k)) return true;
  }
  return false;
}

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const me = await requireUser();
  const perms = await getPermissions(me.agentId);
  if (!perms?.canCreate) {
    return NextResponse.json(
      { error: "신규 등록(엑셀 업로드) 권한이 없습니다. 관리자에게 문의하세요." },
      { status: 403 },
    );
  }

  const mode = req.nextUrl.searchParams.get("mode") ?? "preview";
  if (mode !== "preview" && mode !== "apply") {
    return NextResponse.json({ error: "mode must be preview or apply" }, { status: 400 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "파일이 첨부되지 않았습니다." }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "10MB 이하 파일만 업로드 가능합니다." }, { status: 400 });
  }

  const buf = await file.arrayBuffer();
  const parsed = await parseCustomersWorkbook(buf);

  if (parsed.headerErrors.length) {
    return NextResponse.json(
      {
        ok: false,
        headerErrors: parsed.headerErrors,
        total: parsed.total,
      },
      { status: 400 },
    );
  }

  // agentId 유효성 검증: users 테이블에 존재하는지
  const existingUsers = await db.query.users.findMany({
    columns: { agentId: true },
  });
  const validAgentIds = new Set(existingUsers.map((u) => u.agentId));

  let unknownAgentCount = 0;
  let invalidCount = 0;
  for (const row of parsed.rows) {
    if (row.customer.agentId && !validAgentIds.has(row.customer.agentId)) {
      unknownAgentCount++;
      row.errors.push(`미등록 담당자ID: ${row.customer.agentId}`);
    }
    if (row.errors.length) invalidCount++;
  }

  const previewSample = parsed.rows.slice(0, 10).map((r) => ({
    rowNumber: r.rowNumber,
    name: r.customer.name,
    agentId: r.customer.agentId,
    phone1: r.customer.phone1,
    address: r.customer.address,
    callResult: r.customer.callResult,
    errors: r.errors,
  }));

  if (mode === "preview") {
    return NextResponse.json({
      ok: true,
      total: parsed.total,
      invalidCount,
      unknownAgentCount,
      previewSample,
    });
  }

  // apply — 오류 있는 행은 건너뜀, 미등록 담당자는 null 처리
  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  let rrnBackCount = 0;
  let rrnFrontCount = 0;

  for (const row of parsed.rows) {
    if (!row.customer.name || row.customer.name === "이름없음") continue;
    const c: Partial<NewCustomer> & typeof row.customer = { ...row.customer };
    if (c.agentId && !validAgentIds.has(c.agentId)) c.agentId = null;

    // 주민번호 뒷자리 평문 저장
    const rrnBack = extractRrnBackRaw(row.raw);
    if (rrnBack) {
      c.rrnBack = rrnBack;
      rrnBackCount++;
    }
    // 주민번호 앞자리 평문 저장 (생년월일에서 파생, YYMMDD)
    const front = birthDateToFrontYymmdd(row.customer.birthDate ?? null);
    if (front) {
      c.rrnFront = front;
      rrnFrontCount++;
    }

    // 1순위: customer_code
    if (c.customerCode) {
      const existing = await db.query.customers.findFirst({
        where: eq(customers.customerCode, c.customerCode),
      });
      if (existing) {
        if (hasChanges(existing, c)) {
          await db
            .update(customers)
            .set({ ...c, updatedAt: new Date() })
            .where(eq(customers.id, existing.id));
          updated++;
        } else {
          // 값이 동일하면 DB 를 건드리지 않음 → updatedAt 도 그대로 유지
          unchanged++;
        }
        continue;
      }
    } else if (c.name && c.phone1) {
      // 2순위(fallback): (이름 + 연락처) 로 기존 레코드 식별 — 반복 업로드 시 중복 방지
      const existing = await db.query.customers.findFirst({
        where: and(
          isNull(customers.customerCode),
          eq(customers.name, c.name),
          eq(customers.phone1, c.phone1),
        ),
      });
      if (existing) {
        if (hasChanges(existing, c)) {
          await db
            .update(customers)
            .set({ ...c, updatedAt: new Date() })
            .where(eq(customers.id, existing.id));
          updated++;
        } else {
          unchanged++;
        }
        continue;
      }
    }
    await db.insert(customers).values(c as NewCustomer);
    inserted++;
  }

  void users; // ts: keep import
  return NextResponse.json({
    ok: true,
    total: parsed.total,
    inserted,
    updated,
    unchanged,
    skipped: parsed.total - inserted - updated - unchanged,
    invalidCount,
    unknownAgentCount,
    rrnBackCount,
    rrnFrontCount,
  });
}

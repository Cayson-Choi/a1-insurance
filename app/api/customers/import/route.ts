import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { customers, users } from "@/lib/db/schema";
import { requireUser, getPermissions } from "@/lib/auth/rbac";
import { parseCustomersWorkbook } from "@/lib/excel/importer";
import { birthDateToFrontYymmdd, extractRrnBackRaw } from "@/lib/excel/column-map";
import type { NewCustomer } from "@/lib/db/schema";

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
        await db
          .update(customers)
          .set({ ...c, updatedAt: new Date() })
          .where(eq(customers.id, existing.id));
        updated++;
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
        await db
          .update(customers)
          .set({ ...c, updatedAt: new Date() })
          .where(eq(customers.id, existing.id));
        updated++;
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
    skipped: parsed.total - inserted - updated,
    invalidCount,
    unknownAgentCount,
    rrnBackCount,
    rrnFrontCount,
  });
}

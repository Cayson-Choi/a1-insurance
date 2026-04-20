import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { customers, users } from "@/lib/db/schema";
import { requireUser, getPermissions } from "@/lib/auth/rbac";
import { parseCustomersWorkbook } from "@/lib/excel/importer";
import {
  EXCEL_HEADERS,
  birthDateToFrontYymmdd,
  extractRrnBackRaw,
  parseDateTimeCell,
} from "@/lib/excel/column-map";
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

  // preview: 기존 DB 고객 수 포함 (확인 다이얼로그에 표시용)
  if (mode === "preview") {
    const [{ count: existingCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(customers);
    return NextResponse.json({
      ok: true,
      total: parsed.total,
      existingCount,
      invalidCount,
      unknownAgentCount,
      previewSample,
    });
  }

  // apply — 전체 교체: 기존 customers 전부 삭제 후 엑셀의 행들을 새로 INSERT.
  //   · 트랜잭션으로 감싸서 중간 실패 시 기존 데이터 보존
  //   · 등록일/수정일 은 엑셀 값 그대로 사용 (빈 셀이면 NULL — NOT NULL 제약은 마이그 0007 에서 해제됨)
  //   · audit_logs 는 customer_id FK(ON DELETE SET NULL)로 남아있음 — 과거 이력 보존
  let inserted = 0;
  let rrnBackCount = 0;
  let rrnFrontCount = 0;
  let deletedCount = 0;

  await db.transaction(async (tx) => {
    // 1) 전체 삭제
    const deleted = await tx.delete(customers).returning({ id: customers.id });
    deletedCount = deleted.length;

    // 2) 엑셀의 모든 유효 행 INSERT
    for (const row of parsed.rows) {
      if (!row.customer.name || row.customer.name === "이름없음") continue;

      const c: Partial<NewCustomer> & typeof row.customer = { ...row.customer };
      if (c.agentId && !validAgentIds.has(c.agentId)) c.agentId = null;

      // 주민번호 뒷자리
      const rrnBack = extractRrnBackRaw(row.raw);
      if (rrnBack) {
        c.rrnBack = rrnBack;
        rrnBackCount++;
      }
      // 주민번호 앞자리 (생년월일에서 파생)
      const front = birthDateToFrontYymmdd(row.customer.birthDate ?? null);
      if (front) {
        c.rrnFront = front;
        rrnFrontCount++;
      }

      // 엑셀의 "등록일" / "수정일[]" 값 — 빈 셀이면 null, drizzle 이 SQL NULL 로 저장.
      // defaultNow() 를 우회하려면 명시적으로 null 전달 필요 (undefined 면 DB 기본값 NOW() 적용됨).
      const excelCreatedAt = parseDateTimeCell(row.raw[EXCEL_HEADERS.createdAtRaw]);
      const excelUpdatedAt = parseDateTimeCell(row.raw[EXCEL_HEADERS.updatedAtRaw]);

      await tx.insert(customers).values({
        ...c,
        createdAt: excelCreatedAt,
        updatedAt: excelUpdatedAt,
      } as NewCustomer);
      inserted++;
    }
  });

  void users; // ts: keep import
  return NextResponse.json({
    ok: true,
    total: parsed.total,
    deletedCount,
    inserted,
    skipped: parsed.total - inserted,
    invalidCount,
    unknownAgentCount,
    rrnBackCount,
    rrnFrontCount,
  });
}

import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { customers, auditLogs } from "@/lib/db/schema";
import {
  requireUser,
  getPermissions,
  canSeeAllCustomers,
  canReassignAgent,
} from "@/lib/auth/rbac";
import { parseCustomersWorkbook } from "@/lib/excel/importer";
import {
  EXCEL_HEADERS,
  birthDateToFrontYymmdd,
  extractRrnBackRaw,
  parseDateTimeCell,
} from "@/lib/excel/column-map";
import type { NewCustomer, Customer } from "@/lib/db/schema";
import {
  encodeRrnBackFields,
  encodeRrnFields,
  encodeRrnFrontFields,
  getStoredRrnBackHash,
  getStoredRrnFrontHash,
  piiHash,
} from "@/lib/security/pii";
import {
  apiSecurityHeaders,
  isSameOrigin,
  rateLimit,
  rateLimitKey,
  tooManyRequests,
} from "@/lib/security/rate-limit";

// 엑셀 1회 처리 상한 — 메모리 폭주(zip-bomb 변형)·UI 멈춤 방지.
// 운영 데이터 규모(~수만 건) 고려 50,000 행이면 충분.
const MAX_IMPORT_ROWS = 50_000;
const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
const IMPORT_INSERT_CHUNK_SIZE = 500;

type ExistingCustomerMatch = Pick<
  Customer,
  "id" | "customerCode" | "agentId" | "name" | "phone1" | "rrnFrontHash" | "rrnBackHash"
>;

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * 전화번호 정규화: 숫자만 추출. 이름+전화1 매칭에서 사용.
 */
function normalizePhone(p: string | null | undefined): string {
  if (!p) return "";
  return p.replace(/\D/g, "");
}

function isXlsxBuffer(buf: ArrayBuffer): boolean {
  const sig = new Uint8Array(buf.slice(0, 4));
  return sig[0] === 0x50 && sig[1] === 0x4b && sig[2] === 0x03 && sig[3] === 0x04;
}

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const res = NextResponse.json(body, init);
  return apiSecurityHeaders(res) as NextResponse;
}

export async function POST(req: NextRequest) {
  const me = await requireUser();
  if (!isSameOrigin(req)) {
    return jsonNoStore({ error: "허용되지 않은 요청 출처입니다." }, { status: 403 });
  }
  const limited = rateLimit(rateLimitKey("customers-import", me.agentId, req), 8, 60_000);
  if (!limited.ok) return tooManyRequests(limited.resetAt);

  const perms = await getPermissions(me.agentId);
  if (!perms?.canCreate) {
    return jsonNoStore(
      { error: "신규 등록(엑셀 업로드) 권한이 없습니다. 관리자에게 문의하세요." },
      { status: 403 },
    );
  }

  const mode = req.nextUrl.searchParams.get("mode") ?? "preview";
  if (mode !== "preview" && mode !== "apply") {
    return jsonNoStore({ error: "mode must be preview or apply" }, { status: 400 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return jsonNoStore({ error: "파일이 첨부되지 않았습니다." }, { status: 400 });
  }
  if (file.size > MAX_IMPORT_BYTES) {
    return jsonNoStore({ error: "10MB 이하 파일만 업로드 가능합니다." }, { status: 400 });
  }
  // 확장자 우선 검증 + MIME 보조 검증.
  // 일부 브라우저는 빈 문자열이나 application/octet-stream 을 보내므로 MIME 만으로는 막을 수 없고,
  // 그렇다고 octet-stream 을 화이트리스트에 넣으면 임의 파일이 통과되므로 확장자(.xlsx/.xls) 만으로 차단한다.
  const ALLOWED_MIMES = new Set([
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "application/octet-stream",
    "",
  ]);
  const lowerName = file.name.toLowerCase();
  const hasXlsxExt = lowerName.endsWith(".xlsx");
  if (!hasXlsxExt || !ALLOWED_MIMES.has(file.type)) {
    return jsonNoStore(
      { error: "엑셀 파일(.xlsx)만 업로드 가능합니다." },
      { status: 400 },
    );
  }

  const buf = await file.arrayBuffer();
  if (!isXlsxBuffer(buf)) {
    return jsonNoStore(
      { error: "유효한 .xlsx 파일이 아닙니다." },
      { status: 400 },
    );
  }

  let parsed: Awaited<ReturnType<typeof parseCustomersWorkbook>>;
  try {
    parsed = await parseCustomersWorkbook(buf);
  } catch (e) {
    console.warn("[import] workbook parse failed:", e);
    return jsonNoStore(
      { error: "엑셀 파일을 읽을 수 없습니다. 파일 형식을 확인해주세요." },
      { status: 400 },
    );
  }

  if (parsed.total > MAX_IMPORT_ROWS) {
    return jsonNoStore(
      {
        error: `한 번에 업로드 가능한 행은 최대 ${MAX_IMPORT_ROWS.toLocaleString()}건입니다. 파일을 분할해 주세요.`,
      },
      { status: 400 },
    );
  }

  if (parsed.headerErrors.length) {
    return jsonNoStore(
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

  // RBAC 스코프: agent 는 본인 담당분만 매칭 풀에 포함 — 타 담당자 고객을
  // customer_code/주민/이름+전화 매칭으로 가로채는 우회 차단.
  // admin·manager 는 전체.
  const scopeWhere = canSeeAllCustomers(me) ? sql`true` : eq(customers.agentId, me.agentId);

  // agent role 은 자기 자신에게만 신규 할당 가능 — 엑셀 agentId 컬럼으로 다른 담당자에게
  // 일괄 할당하는 경로를 차단. admin·manager 는 자유 재할당 가능.
  const enforceSelfAssign = !canReassignAgent(me);

  // preview: 기존 DB 고객 수 + 예상 매칭 시뮬레이션
  if (mode === "preview") {
    const [{ count: existingCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(customers)
      .where(scopeWhere);

    // 매칭 시뮬레이션: DB 를 읽어서 엑셀 행마다 어떤 키로 매칭될지 카운트만 계산 (쓰기 없음)
    const allExisting = await db
      .select({
        id: customers.id,
        customerCode: customers.customerCode,
        agentId: customers.agentId,
        name: customers.name,
        phone1: customers.phone1,
        rrnFrontHash: customers.rrnFrontHash,
        rrnBackHash: customers.rrnBackHash,
      })
      .from(customers)
      .where(scopeWhere);
    const byCode = new Map<string, ExistingCustomerMatch>();
    const byRrn = new Map<string, ExistingCustomerMatch>();
    const byNamePhone = new Map<string, ExistingCustomerMatch>();
    for (const c of allExisting) {
      if (c.customerCode) byCode.set(c.customerCode, c);
      const frontHash = getStoredRrnFrontHash(c);
      const backHash = getStoredRrnBackHash(c);
      if (frontHash && backHash) byRrn.set(`${frontHash}|${backHash}`, c);
      if (c.name && c.phone1) {
        byNamePhone.set(`${c.name}|${normalizePhone(c.phone1)}`, c);
      }
    }

    let willUpdate = 0;
    let willInsert = 0;
    let matchedCode = 0;
    let matchedRrn = 0;
    let matchedNamePhone = 0;
    for (const row of parsed.rows) {
      if (!row.customer.name || row.customer.name === "이름없음") continue;
      const c = row.customer;
      // agent 는 자기 자신에게만 할당 가능 — 시뮬레이션에서도 동일하게 보정해 미리보기/실행 결과 일치.
      if (enforceSelfAssign && c.agentId && c.agentId !== me.agentId) {
        c.agentId = me.agentId;
      }
      const rrnFront = birthDateToFrontYymmdd(c.birthDate ?? null);
      const rrnBack = extractRrnBackRaw(row.raw);
      if (c.customerCode && byCode.has(c.customerCode)) {
        willUpdate++;
        matchedCode++;
      } else if (
        rrnFront &&
        rrnBack &&
        byRrn.has(`${piiHash(rrnFront)}|${piiHash(rrnBack)}`)
      ) {
        willUpdate++;
        matchedRrn++;
      } else if (
        c.name &&
        c.phone1 &&
        byNamePhone.has(`${c.name}|${normalizePhone(c.phone1)}`)
      ) {
        willUpdate++;
        matchedNamePhone++;
      } else {
        willInsert++;
      }
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

    return jsonNoStore({
      ok: true,
      total: parsed.total,
      existingCount,
      invalidCount,
      unknownAgentCount,
      willUpdate,
      willInsert,
      matchedCode,
      matchedRrn,
      matchedNamePhone,
      previewSample,
    });
  }

  // apply — upsert 전략
  //   1) 사전 로드: 고객코드 · 주민번호(앞+뒤) · 이름+전화1 세 가지 맵
  //   2) 엑셀 각 행마다 우선순위로 매칭
  //      code → rrn → namePhone → INSERT
  //   3) UPDATE 시 빈 값(null) 은 patch 에서 제외 → 엑셀 빈 셀 = 기존 값 보존
  //      memo / reservationAt / createdAt 은 엑셀에 없는 웹 전용 필드이므로 무조건 건드리지 않음
  //   4) 전체 트랜잭션으로 감싸 일관성 유지. 중간 실패 시 모두 롤백.
  let updated = 0;
  let unchanged = 0;
  let inserted = 0;
  let matchedCode = 0;
  let matchedRrn = 0;
  let matchedNamePhone = 0;
  let skipped = 0;
  let existingTotal = 0;

  try {
    await db.transaction(async (tx) => {
      // RBAC 스코프 적용 — agent 는 본인 담당분만 매칭 가능. (preview 와 동일 로직)
      const allExisting = await tx
        .select({
          id: customers.id,
          customerCode: customers.customerCode,
          agentId: customers.agentId,
          name: customers.name,
          phone1: customers.phone1,
          rrnFrontHash: customers.rrnFrontHash,
          rrnBackHash: customers.rrnBackHash,
        })
        .from(customers)
        .where(scopeWhere);
      existingTotal = allExisting.length;

      const byCode = new Map<string, ExistingCustomerMatch>();
      const byRrn = new Map<string, ExistingCustomerMatch>();
      const byNamePhone = new Map<string, ExistingCustomerMatch>();
      const pendingInserts: NewCustomer[] = [];
      for (const c of allExisting) {
        if (c.customerCode) byCode.set(c.customerCode, c);
        const frontHash = getStoredRrnFrontHash(c);
        const backHash = getStoredRrnBackHash(c);
        if (frontHash && backHash) byRrn.set(`${frontHash}|${backHash}`, c);
        if (c.name && c.phone1) {
          byNamePhone.set(`${c.name}|${normalizePhone(c.phone1)}`, c);
        }
      }

      for (const row of parsed.rows) {
        if (!row.customer.name || row.customer.name === "이름없음") {
          skipped++;
          continue;
        }

        const c = { ...row.customer };
        if (c.agentId && !validAgentIds.has(c.agentId)) c.agentId = null;
        // agent 는 본인 외 다른 담당자에게 신규 할당 불가 — 강제로 본인으로 보정.
        if (enforceSelfAssign && c.agentId && c.agentId !== me.agentId) {
          c.agentId = me.agentId;
        }
        if (enforceSelfAssign && !c.agentId) {
          // agentId 미지정 신규 등록은 actor 본인 소유로 (무주공 데이터 방지).
          c.agentId = me.agentId;
        }

        const rrnBack = extractRrnBackRaw(row.raw);
        const rrnFront = birthDateToFrontYymmdd(c.birthDate ?? null);

        // --- 매칭 ---
        let existing: ExistingCustomerMatch | undefined;
        if (c.customerCode && byCode.has(c.customerCode)) {
          existing = byCode.get(c.customerCode);
          matchedCode++;
        } else if (rrnFront && rrnBack) {
          const rrnKey = `${piiHash(rrnFront)}|${piiHash(rrnBack)}`;
          if (byRrn.has(rrnKey)) {
            existing = byRrn.get(rrnKey);
            matchedRrn++;
          }
        } else if (c.name && c.phone1) {
          const np = `${c.name}|${normalizePhone(c.phone1)}`;
          if (byNamePhone.has(np)) {
            existing = byNamePhone.get(np);
            matchedNamePhone++;
          }
        }

        if (existing) {
          // --- UPDATE: 빈 값은 제외 (기존 값 보존).
          // memo, reservationAt, createdAt 은 엑셀에 없으므로 건드리지 않음.
          const patch: Partial<NewCustomer> = {};
          const setIf = <K extends keyof NewCustomer>(
            key: K,
            value: NewCustomer[K] | null | undefined,
          ) => {
            if (value !== null && value !== undefined) {
              patch[key] = value as NewCustomer[K];
            }
          };
          setIf("customerCode", c.customerCode);
          setIf("agentId", c.agentId);
          setIf("name", c.name);
          setIf("birthDate", c.birthDate);
          setIf("phone1", c.phone1);
          setIf("job", c.job);
          setIf("address", c.address);
          setIf("addressDetail", c.addressDetail);
          setIf("callResult", c.callResult);
          setIf("dbProduct", c.dbProduct);
          setIf("dbPremium", c.dbPremium);
          setIf("dbHandler", c.dbHandler);
          setIf("subCategory", c.subCategory);
          setIf("dbPolicyNo", c.dbPolicyNo);
          setIf("dbRegisteredAt", c.dbRegisteredAt);
          setIf("mainCategory", c.mainCategory);
          setIf("dbStartAt", c.dbStartAt);
          setIf("dbEndAt", c.dbEndAt);
          setIf("branch", c.branch);
          setIf("hq", c.hq);
          setIf("team", c.team);
          setIf("fax", c.fax);
          setIf("reservationReceived", c.reservationReceived);
          setIf("dbCompany", c.dbCompany);
          if (rrnBack && rrnFront) {
            Object.assign(
              patch,
              encodeRrnFields({
                rrnFront,
                rrnBack,
              }),
            );
          } else if (rrnFront) {
            Object.assign(patch, encodeRrnFrontFields(rrnFront));
          } else if (rrnBack) {
            Object.assign(patch, encodeRrnBackFields(rrnBack));
          }

          if (Object.keys(patch).length > 0) {
            patch.updatedAt = new Date();
            await tx.update(customers).set(patch).where(eq(customers.id, existing.id));
            updated++;
          } else {
            unchanged++;
          }
        } else {
          // --- INSERT (신규)
          const excelCreatedAt = parseDateTimeCell(row.raw[EXCEL_HEADERS.createdAtRaw]);
          const excelUpdatedAt = parseDateTimeCell(row.raw[EXCEL_HEADERS.updatedAtRaw]);

          const rrnFields = encodeRrnFields({ rrnFront, rrnBack });
          const insertValues: NewCustomer = {
            customerCode: c.customerCode ?? null,
            agentId: c.agentId ?? null,
            name: c.name,
            birthDate: c.birthDate ?? null,
            phone1: c.phone1 ?? null,
            job: c.job ?? null,
            address: c.address ?? null,
            addressDetail: c.addressDetail ?? null,
            callResult: c.callResult ?? null,
            dbProduct: c.dbProduct ?? null,
            dbPremium: c.dbPremium ?? null,
            dbHandler: c.dbHandler ?? null,
            subCategory: c.subCategory ?? null,
            dbPolicyNo: c.dbPolicyNo ?? null,
            dbRegisteredAt: c.dbRegisteredAt ?? null,
            mainCategory: c.mainCategory ?? null,
            dbStartAt: c.dbStartAt ?? null,
            dbEndAt: c.dbEndAt ?? null,
            branch: c.branch ?? null,
            hq: c.hq ?? null,
            team: c.team ?? null,
            fax: c.fax ?? null,
            reservationReceived: c.reservationReceived ?? null,
            dbCompany: c.dbCompany ?? null,
            ...rrnFields,
            createdAt: excelCreatedAt ?? new Date(),
            updatedAt: excelUpdatedAt ?? new Date(),
          };

          pendingInserts.push(insertValues);

          // 같은 엑셀 안에 동일 식별자 가진 행이 또 나올 수 있으니 맵 업데이트 → 두 번째 행부터 UPDATE 로 빠짐
        }
      }

      for (let i = 0; i < pendingInserts.length; i += IMPORT_INSERT_CHUNK_SIZE) {
        const chunk = pendingInserts.slice(i, i + IMPORT_INSERT_CHUNK_SIZE);
        const result = await tx
          .insert(customers)
          .values(chunk)
          .onConflictDoNothing();
        inserted += result.count;
      }
    });
  } catch (e) {
    // 클라이언트에는 generic 메시지만 노출 — DB 스키마/내부 경로 leak 방지.
    // 운영 디버깅은 서버 로그에서.
    console.error("[import] upsert transaction failed:", e);
    return jsonNoStore(
      {
        ok: false,
        error: "업로드 중 오류가 발생했습니다. 엑셀 형식을 확인하고 다시 시도하세요.",
      },
      { status: 500 },
    );
  }

  // 엑셀에 매칭 안 된 기존 고객 = 그대로 유지됨
  const untouched = existingTotal - (updated + unchanged);

  // 대량 변경 추적 — 행별 diff 가 아닌 요약을 단일 audit row 로 남김 (감사 부담 최소화).
  // customerId 는 일괄성 동작이라 NULL.
  if (updated > 0 || inserted > 0) {
    try {
      await db.insert(auditLogs).values({
        actorAgentId: me.agentId,
        customerId: null,
        action: "import",
        before: null,
        after: {
          total: parsed.total,
          updated,
          inserted,
          unchanged,
          skipped,
          invalidCount,
          unknownAgentCount,
          enforceSelfAssign,
        },
      });
    } catch (e) {
      console.warn("[import] audit insert failed:", e);
    }
  }

  return jsonNoStore({
    ok: true,
    total: parsed.total,
    existingTotal,
    updated,
    unchanged,
    inserted,
    untouched,
    matchedCode,
    matchedRrn,
    matchedNamePhone,
    skipped,
    invalidCount,
    unknownAgentCount,
  });
}

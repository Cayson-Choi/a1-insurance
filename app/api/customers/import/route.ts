import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { customers, auditLogs, users } from "@/lib/db/schema";
import {
  requireUser,
  getPermissions,
  canSeeAllCustomers,
  canReassignAgent,
} from "@/lib/auth/rbac";
import { hashPassword } from "@/lib/auth/password";
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

// ?묒? 1??泥섎━ ?곹븳 ??硫붾え由???＜(zip-bomb 蹂??쨌UI 硫덉땄 諛⑹?.
// ?댁쁺 ?곗씠??洹쒕え(~?섎쭔 嫄? 怨좊젮 50,000 ?됱씠硫?異⑸텇.
const MAX_IMPORT_ROWS = 50_000;
const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
const IMPORT_INSERT_CHUNK_SIZE = 500;
// 자동 생성 계정은 랜덤 비밀번호 → 관리자가 직접 비밀번호를 리셋해야만 로그인 가능.
// 고정 비밀번호("123456") 사용 시 제3자가 즉시 로그인 가능한 심각한 보안 위험.
function generateRandomPassword(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
  const bytes = randomBytes(24);
  return Array.from(bytes, (b: number) => chars[b % chars.length]).join("");
}
const AGENT_ID_RE = /^[a-zA-Z0-9_-]{2,20}$/;

type ExistingCustomerMatch = Pick<
  Customer,
  | "id"
  | "customerCode"
  | "agentId"
  | "name"
  | "birthDate"
  | "phone1"
  | "job"
  | "address"
  | "addressDetail"
  | "callResult"
  | "dbProduct"
  | "dbPremium"
  | "dbHandler"
  | "subCategory"
  | "dbPolicyNo"
  | "dbRegisteredAt"
  | "mainCategory"
  | "dbStartAt"
  | "dbEndAt"
  | "branch"
  | "hq"
  | "team"
  | "fax"
  | "reservationReceived"
  | "dbCompany"
  | "rrnFrontHash"
  | "rrnBackEnc"
  | "rrnBackHash"
>;

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * ?꾪솕踰덊샇 ?뺢퇋?? ?レ옄留?異붿텧. ?대쫫+?꾪솕1 留ㅼ묶?먯꽌 ?ъ슜.
 */
function normalizePhone(p: string | null | undefined): string {
  if (!p) return "";
  return p.replace(/\D/g, "");
}

function isValidAgentId(agentId: string): boolean {
  return AGENT_ID_RE.test(agentId);
}

function agentNameFromRow(raw: Record<string, unknown>, agentId: string): string {
  const value = raw[EXCEL_HEADERS.agentName];
  const name =
    typeof value === "string" || typeof value === "number"
      ? String(value).trim()
      : "";
  return (name || agentId).slice(0, 60);
}

function isXlsxBuffer(buf: ArrayBuffer): boolean {
  const sig = new Uint8Array(buf.slice(0, 4));
  return sig[0] === 0x50 && sig[1] === 0x4b && sig[2] === 0x03 && sig[3] === 0x04;
}

function normalizeDateKey(value: unknown): string {
  if (!value) return "";
  if (value instanceof Date) return Number.isNaN(value.valueOf()) ? "" : value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function sameValue(existing: unknown, next: unknown): boolean {
  return String(existing ?? "") === String(next ?? "");
}

function buildCustomerPatch(
  existing: ExistingCustomerMatch,
  c: NewCustomer,
  rrnFront: string | null,
  rrnBack: string | null,
): Partial<NewCustomer> {
  const patch: Partial<NewCustomer> = {};
  const setIf = <K extends keyof NewCustomer>(
    key: K,
    existingValue: unknown,
    nextValue: NewCustomer[K] | null | undefined,
  ) => {
    if (nextValue !== null && nextValue !== undefined && !sameValue(existingValue, nextValue)) {
      patch[key] = nextValue as NewCustomer[K];
    }
  };

  setIf("customerCode", existing.customerCode, c.customerCode);
  setIf("agentId", existing.agentId, c.agentId);
  setIf("name", existing.name, c.name);
  setIf("birthDate", normalizeDateKey(existing.birthDate), c.birthDate);
  setIf("phone1", existing.phone1, c.phone1);
  setIf("job", existing.job, c.job);
  setIf("address", existing.address, c.address);
  setIf("addressDetail", existing.addressDetail, c.addressDetail);
  setIf("callResult", existing.callResult, c.callResult);
  setIf("dbProduct", existing.dbProduct, c.dbProduct);
  setIf("dbPremium", existing.dbPremium, c.dbPremium);
  setIf("dbHandler", existing.dbHandler, c.dbHandler);
  setIf("subCategory", existing.subCategory, c.subCategory);
  setIf("dbPolicyNo", existing.dbPolicyNo, c.dbPolicyNo);
  setIf("dbRegisteredAt", normalizeDateKey(existing.dbRegisteredAt), c.dbRegisteredAt);
  setIf("mainCategory", existing.mainCategory, c.mainCategory);
  setIf("dbStartAt", normalizeDateKey(existing.dbStartAt), c.dbStartAt);
  setIf("dbEndAt", normalizeDateKey(existing.dbEndAt), c.dbEndAt);
  setIf("branch", existing.branch, c.branch);
  setIf("hq", existing.hq, c.hq);
  setIf("team", existing.team, c.team);
  setIf("fax", existing.fax, c.fax);
  setIf("reservationReceived", normalizeDateKey(existing.reservationReceived), c.reservationReceived);
  setIf("dbCompany", existing.dbCompany, c.dbCompany);

  if (rrnFront && rrnBack) {
    const encoded = encodeRrnFields({ rrnFront, rrnBack });
    const nextFrontHash = encoded.rrnFrontHash;
    const nextBackHash = encoded.rrnBackHash;
    if (!sameValue(existing.rrnFrontHash, nextFrontHash)) {
      patch.rrnFrontHash = nextFrontHash;
    }
    if (!sameValue(existing.rrnBackHash, nextBackHash)) {
      patch.rrnBackHash = nextBackHash;
    }
    if (!sameValue(existing.rrnBackEnc, encoded.rrnBackEnc)) {
      patch.rrnBackEnc = encoded.rrnBackEnc;
    }
  } else if (rrnFront) {
    const encoded = encodeRrnFrontFields(rrnFront);
    if (!sameValue(existing.rrnFrontHash, encoded.rrnFrontHash)) {
      patch.rrnFrontHash = encoded.rrnFrontHash;
    }
  } else if (rrnBack) {
    const encoded = encodeRrnBackFields(rrnBack);
    if (!sameValue(existing.rrnBackEnc, encoded.rrnBackEnc)) {
      patch.rrnBackEnc = encoded.rrnBackEnc;
    }
    if (!sameValue(existing.rrnBackHash, encoded.rrnBackHash)) {
      patch.rrnBackHash = encoded.rrnBackHash;
    }
  }

  return patch;
}

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const res = NextResponse.json(body, init);
  return apiSecurityHeaders(res) as NextResponse;
}

export async function POST(req: NextRequest) {
  const me = await requireUser();
  if (!isSameOrigin(req)) {
    return jsonNoStore({ error: "?덉슜?섏? ?딆? ?붿껌 異쒖쿂?낅땲??" }, { status: 403 });
  }
  const limited = rateLimit(rateLimitKey("customers-import", me.agentId, req), 8, 60_000);
  if (!limited.ok) return tooManyRequests(limited.resetAt);

  const perms = await getPermissions(me.agentId);
  if (!perms?.canCreate) {
    return jsonNoStore(
      { error: "?좉퇋 ?깅줉(?묒? ?낅줈?? 沅뚰븳???놁뒿?덈떎. 愿由ъ옄?먭쾶 臾몄쓽?섏꽭??" },
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
    return jsonNoStore({ error: "?뚯씪??泥⑤??섏? ?딆븯?듬땲??" }, { status: 400 });
  }
  if (file.size > MAX_IMPORT_BYTES) {
    return jsonNoStore({ error: "10MB ?댄븯 ?뚯씪留??낅줈??媛?ν빀?덈떎." }, { status: 400 });
  }
  // ?뺤옣???곗꽑 寃利?+ MIME 蹂댁“ 寃利?
  // ?쇰? 釉뚮씪?곗???鍮?臾몄옄?댁씠??application/octet-stream ??蹂대궡誘濡?MIME 留뚯쑝濡쒕뒗 留됱쓣 ???녾퀬,
  // 洹몃젃?ㅺ퀬 octet-stream ???붿씠?몃━?ㅽ듃???ｌ쑝硫??꾩쓽 ?뚯씪???듦낵?섎?濡??뺤옣??.xlsx/.xls) 留뚯쑝濡?李⑤떒?쒕떎.
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
      { error: "?묒? ?뚯씪(.xlsx)留??낅줈??媛?ν빀?덈떎." },
      { status: 400 },
    );
  }

  const buf = await file.arrayBuffer();
  if (!isXlsxBuffer(buf)) {
    return jsonNoStore(
      { error: "?좏슚??.xlsx ?뚯씪???꾨떃?덈떎." },
      { status: 400 },
    );
  }

  let parsed: Awaited<ReturnType<typeof parseCustomersWorkbook>>;
  try {
    parsed = await parseCustomersWorkbook(buf);
  } catch (e) {
    console.warn("[import] workbook parse failed:", e);
    return jsonNoStore(
      { error: "?묒? ?뚯씪???쎌쓣 ???놁뒿?덈떎. ?뚯씪 ?뺤떇???뺤씤?댁＜?몄슂." },
      { status: 400 },
    );
  }

  if (parsed.total > MAX_IMPORT_ROWS) {
    return jsonNoStore(
      {
        error: `??踰덉뿉 ?낅줈??媛?ν븳 ?됱? 理쒕? ${MAX_IMPORT_ROWS.toLocaleString()}嫄댁엯?덈떎. ?뚯씪??遺꾪븷??二쇱꽭??`,
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

  // agentId ?좏슚??寃利? users ?뚯씠釉붿뿉 議댁옱?섎뒗吏
  const existingUsers = await db.query.users.findMany({
    columns: { agentId: true },
  });
  const validAgentIds = new Set(existingUsers.map((u) => u.agentId));
  const canAutoCreateAgents = canReassignAgent(me);
  const enforceSelfAssign = !canAutoCreateAgents;
  const missingAgents = new Map<string, string>();

  let unknownAgentCount = 0;
  let invalidCount = 0;
  for (const row of parsed.rows) {
    const agentId = row.customer.agentId;
    if (agentId) {
      if (!isValidAgentId(agentId)) {
        row.errors.push(`?대떦?륤D ?뺤떇 ?ㅻ쪟: ${agentId}`);
      } else if (!validAgentIds.has(agentId)) {
        if (canAutoCreateAgents) {
          missingAgents.set(agentId, agentNameFromRow(row.raw, agentId));
        } else {
          unknownAgentCount++;
          row.errors.push(`誘몃벑濡??대떦?륤D: ${agentId}`);
        }
      }
    }
    if (row.errors.length) invalidCount++;
  }
  const autoCreateAgentCount = canAutoCreateAgents ? missingAgents.size : 0;

  // RBAC ?ㅼ퐫?? agent ??蹂몄씤 ?대떦遺꾨쭔 留ㅼ묶 ????ы븿 ??? ?대떦??怨좉컼??
  // customer_code/二쇰?/?대쫫+?꾪솕 留ㅼ묶?쇰줈 媛濡쒖콈???고쉶 李⑤떒.
  // admin쨌manager ???꾩껜.
  const scopeWhere = canSeeAllCustomers(me) ? sql`true` : eq(customers.agentId, me.agentId);

  // agent role ? ?먭린 ?먯떊?먭쾶留??좉퇋 ?좊떦 媛?????묒? agentId 而щ읆?쇰줈 ?ㅻⅨ ?대떦?먯뿉寃?
  // ?쇨큵 ?좊떦?섎뒗 寃쎈줈瑜?李⑤떒. admin쨌manager ???먯쑀 ?ы븷??媛??

  // preview: 湲곗〈 DB 怨좉컼 ??+ ?덉긽 留ㅼ묶 ?쒕??덉씠??
  if (mode === "preview") {
    const [{ count: existingCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(customers)
      .where(scopeWhere);

    // 留ㅼ묶 ?쒕??덉씠?? DB 瑜??쎌뼱???묒? ?됰쭏???대뼡 ?ㅻ줈 留ㅼ묶?좎? 移댁슫?몃쭔 怨꾩궛 (?곌린 ?놁쓬)
    const allExisting = await db
      .select({
        id: customers.id,
        customerCode: customers.customerCode,
        agentId: customers.agentId,
        name: customers.name,
        birthDate: customers.birthDate,
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
        dbCompany: customers.dbCompany,
        rrnFrontHash: customers.rrnFrontHash,
        rrnBackEnc: customers.rrnBackEnc,
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
    let unchangedCount = 0;
    let willInsert = 0;
    let matchedCode = 0;
    let matchedRrn = 0;
    let matchedNamePhone = 0;
    for (const row of parsed.rows) {
      if (!row.customer.name || row.customer.name === "?대쫫?놁쓬") continue;
      const c = row.customer;
      // agent ???먭린 ?먯떊?먭쾶留??좊떦 媛?????쒕??덉씠?섏뿉?쒕룄 ?숈씪?섍쾶 蹂댁젙??誘몃━蹂닿린/?ㅽ뻾 寃곌낵 ?쇱튂.
      if (enforceSelfAssign && c.agentId && c.agentId !== me.agentId) {
        c.agentId = me.agentId;
      }
      const rrnFront = birthDateToFrontYymmdd(c.birthDate ?? null);
      const rrnBack = extractRrnBackRaw(row.raw);
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
        const patch = buildCustomerPatch(existing, c, rrnFront, rrnBack);
        if (Object.keys(patch).length > 0) willUpdate++;
        else unchangedCount++;
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
      autoCreateAgentCount,
      willUpdate,
      unchangedCount,
      willInsert,
      matchedCode,
      matchedRrn,
      matchedNamePhone,
      previewSample,
    });
  }

  // apply ??upsert ?꾨왂
  //   1) ?ъ쟾 濡쒕뱶: 怨좉컼肄붾뱶 쨌 二쇰?踰덊샇(???? 쨌 ?대쫫+?꾪솕1 ??媛吏 留?
  //   2) ?묒? 媛??됰쭏???곗꽑?쒖쐞濡?留ㅼ묶
  //      code ??rrn ??namePhone ??INSERT
  //   3) UPDATE ??鍮?媛?null) ? patch ?먯꽌 ?쒖쇅 ???묒? 鍮?? = 湲곗〈 媛?蹂댁〈
  //      memo / reservationAt / createdAt ? ?묒????녿뒗 ???꾩슜 ?꾨뱶?대?濡?臾댁“嫄?嫄대뱶由ъ? ?딆쓬
  //   4) ?꾩껜 ?몃옖??뀡?쇰줈 媛먯떥 ?쇨????좎?. 以묎컙 ?ㅽ뙣 ??紐⑤몢 濡ㅻ갚.
  let updated = 0;
  let unchanged = 0;
  let inserted = 0;
  let matchedCode = 0;
  let matchedRrn = 0;
  let matchedNamePhone = 0;
  let skipped = 0;
  let existingTotal = 0;
  let createdAgentCount = 0;

  try {
    await db.transaction(async (tx) => {
      if (missingAgents.size > 0) {
        const randomPw = generateRandomPassword();
        const passwordHash = await hashPassword(randomPw);
        const createdAgents = await tx
          .insert(users)
          .values(
            Array.from(missingAgents.entries()).map(([agentId, name]) => ({
              agentId,
              name,
              role: "agent" as const,
              passwordHash,
              canCreate: false,
              canEdit: false,
              canDelete: false,
              canExport: false,
              canDownloadImage: false,
            })),
          )
          .onConflictDoNothing()
          .returning({
            agentId: users.agentId,
            name: users.name,
            role: users.role,
          });

        createdAgentCount = createdAgents.length;
        for (const agentId of missingAgents.keys()) validAgentIds.add(agentId);

        if (createdAgents.length > 0) {
          await tx.insert(auditLogs).values(
            createdAgents.map((agent) => ({
              actorAgentId: me.agentId,
              customerId: null,
              action: "user_create" as const,
              before: null,
              after: {
                agentId: agent.agentId,
                name: agent.name,
                role: agent.role,
                source: "excel_import",
                initialPassword: "[RANDOM — 관리자 비밀번호 리셋 필요]",
                canCreate: false,
                canEdit: false,
                canDelete: false,
                canExport: false,
                canDownloadImage: false,
              },
            })),
          );
        }
      }

      // RBAC ?ㅼ퐫???곸슜 ??agent ??蹂몄씤 ?대떦遺꾨쭔 留ㅼ묶 媛?? (preview ? ?숈씪 濡쒖쭅)
    const allExisting = await tx
      .select({
        id: customers.id,
        customerCode: customers.customerCode,
        agentId: customers.agentId,
        name: customers.name,
        birthDate: customers.birthDate,
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
        dbCompany: customers.dbCompany,
        rrnFrontHash: customers.rrnFrontHash,
        rrnBackEnc: customers.rrnBackEnc,
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
        if (!row.customer.name || row.customer.name === "?대쫫?놁쓬") {
          skipped++;
          continue;
        }

        const c = { ...row.customer };
        if (c.agentId && !validAgentIds.has(c.agentId)) c.agentId = null;
        // agent ??蹂몄씤 ???ㅻⅨ ?대떦?먯뿉寃??좉퇋 ?좊떦 遺덇? ??媛뺤젣濡?蹂몄씤?쇰줈 蹂댁젙.
        if (enforceSelfAssign && c.agentId && c.agentId !== me.agentId) {
          c.agentId = me.agentId;
        }
        if (enforceSelfAssign && !c.agentId) {
          // agentId 誘몄????좉퇋 ?깅줉? actor 蹂몄씤 ?뚯쑀濡?(臾댁＜怨??곗씠??諛⑹?).
          c.agentId = me.agentId;
        }

        const rrnBack = extractRrnBackRaw(row.raw);
        const rrnFront = birthDateToFrontYymmdd(c.birthDate ?? null);

        // --- 留ㅼ묶 ---
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
          const patch = buildCustomerPatch(existing, c, rrnFront, rrnBack);

          if (Object.keys(patch).length > 0) {
            patch.updatedAt = new Date();
            await tx.update(customers).set(patch).where(eq(customers.id, existing.id));
            updated++;
          } else {
            unchanged++;
          }
        } else {
          // --- INSERT (?좉퇋)
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

          // 媛숈? ?묒? ?덉뿉 ?숈씪 ?앸퀎??媛吏??됱씠 ???섏삱 ???덉쑝??留??낅뜲?댄듃 ????踰덉㎏ ?됰???UPDATE 濡?鍮좎쭚
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
    // ?대씪?댁뼵?몄뿉??generic 硫붿떆吏留??몄텧 ??DB ?ㅽ궎留??대? 寃쎈줈 leak 諛⑹?.
    // ?댁쁺 ?붾쾭源낆? ?쒕쾭 濡쒓렇?먯꽌.
    console.error("[import] upsert transaction failed:", e);
    return jsonNoStore(
      {
        ok: false,
        error: "?낅줈??以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎. ?묒? ?뺤떇???뺤씤?섍퀬 ?ㅼ떆 ?쒕룄?섏꽭??",
      },
      { status: 500 },
    );
  }

  // ?묒???留ㅼ묶 ????湲곗〈 怨좉컼 = 洹몃?濡??좎???
  const untouched = existingTotal - (updated + unchanged);

  // ???蹂寃?異붿쟻 ???됰퀎 diff 媛 ?꾨땶 ?붿빟???⑥씪 audit row 濡??④? (媛먯궗 遺??理쒖냼??.
  // customerId ???쇨큵???숈옉?대씪 NULL.
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
          autoCreateAgentCount,
          createdAgentCount,
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
    autoCreateAgentCount,
    createdAgentCount,
  });
}


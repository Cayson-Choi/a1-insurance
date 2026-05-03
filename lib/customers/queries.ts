import { and, asc, desc, eq, ilike, inArray, isNull, SQL, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { customers, users } from "@/lib/db/schema";
import { CALL_RESULTS, type CallResult } from "@/lib/excel/column-map";
import { canSeeAllCustomers, type SessionUser } from "@/lib/auth/rbac";
import { isSortDir, isSortKey, type SortDir, type SortKey } from "@/lib/customers/columns";
import { getStoredRrnBack, piiHash } from "@/lib/security/pii";

const ALL_AGENT_FILTER = "__all";
const UNASSIGNED_AGENT_FILTER = "__unassigned";

export type CustomerFilter = {
  name?: string;
  address?: string;
  phone?: string;
  callResult?: CallResult;
  agentId?: string;
  rrnFront?: string;
  rrnBack?: string;
  rrnFrontHash?: string;
  rrnBackHash?: string;
  birthYearFrom?: number;
  birthYearTo?: number;
  sort?: SortKey;
  dir?: SortDir;
  page: number;
  perPage: number;
};

// 페이지네이션 상수는 lib/customers/page-config 에서 단일 출처로 관리 (client-safe).
// 기존 import 경로 호환을 위해 re-export.
export {
  DEFAULT_PER_PAGE,
  MAX_PER_PAGE,
  PER_PAGE_OPTIONS,
} from "@/lib/customers/page-config";
import { DEFAULT_PER_PAGE, MAX_PER_PAGE } from "@/lib/customers/page-config";

function parseCallResult(v: unknown): CallResult | undefined {
  if (typeof v !== "string") return undefined;
  return (CALL_RESULTS as readonly string[]).includes(v) ? (v as CallResult) : undefined;
}

function parsePage(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

function parsePerPage(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_PER_PAGE;
  return Math.min(Math.floor(n), MAX_PER_PAGE);
}

export function parseFilter(searchParams: Record<string, string | string[] | undefined>): CustomerFilter {
  const pick = (k: string): string | undefined => {
    const v = searchParams[k];
    if (Array.isArray(v)) return v[0];
    return v;
  };
  const phoneRaw = pick("phone")?.replace(/\D/g, "") ?? "";
  const sortRaw = pick("sort");
  const dirRaw = pick("dir");
  return {
    name: pick("name")?.trim() || undefined,
    address: pick("addr")?.trim() || undefined,
    phone: phoneRaw || undefined,
    callResult: parseCallResult(pick("callResult")),
    agentId: parseAgentId(pick("agentId")),
    birthYearFrom: parseYear(pick("byFrom")),
    birthYearTo: parseYear(pick("byTo")),
    sort: isSortKey(sortRaw) ? sortRaw : undefined,
    dir: isSortDir(dirRaw) ? dirRaw : undefined,
    page: parsePage(pick("page")),
    perPage: parsePerPage(pick("perPage")),
  };
}

function parseYear(v: unknown): number | undefined {
  if (typeof v !== "string") return undefined;
  const n = Number(v.replace(/\D/g, ""));
  if (!Number.isFinite(n) || n < 1900 || n > 2100) return undefined;
  return Math.floor(n);
}

function parseAgentId(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const agentId = v.trim();
  if (!agentId || agentId === ALL_AGENT_FILTER) return undefined;
  return agentId;
}

// get-detail.ts 의 prev/next 계산이 목록의 정렬과 100% 동일하도록 export.
// 하드코딩된 orderBy 와 목록의 사용자 정렬이 어긋나면 팝업 이전/다음이 엉뚱한 고객을 가리키거나
// 리스트에서 찾지 못해(idx = -1) 둘 다 비활성화되는 회귀를 방지.
export function buildOrderBy(sort: SortKey | undefined, dir: SortDir | undefined): SQL[] {
  // 기본: DB 등록일 → createdAt 내림차순
  if (!sort) {
    return [desc(customers.dbRegisteredAt), desc(customers.createdAt)];
  }
  const direction = dir === "asc" ? asc : desc;
  // 컬럼 매핑 — 사용자 정렬 후 안정적인 tie-breaker로 createdAt DESC 추가
  const target = (() => {
    switch (sort) {
      case "customerCode":
        return customers.customerCode;
      case "agentName":
        return users.name;
      case "agentId":
        return customers.agentId;
      case "name":
        return customers.name;
      case "birthDate":
        return customers.birthDate;
      case "rrn":
        // 주민번호는 암호화되어 있으므로 뒷자리 자체로는 정렬하지 않는다.
        return customers.birthDate;
      case "phone1":
        return customers.phone1;
      case "job":
        return customers.job;
      case "address":
        return customers.address;
      case "addressDetail":
        return customers.addressDetail;
      case "callResult":
        return customers.callResult;
      case "dbProduct":
        return customers.dbProduct;
      case "dbPremium":
        return customers.dbPremium;
      case "dbHandler":
        return customers.dbHandler;
      case "subCategory":
        return customers.subCategory;
      case "dbPolicyNo":
        return customers.dbPolicyNo;
      case "dbRegisteredAt":
        return customers.dbRegisteredAt;
      case "mainCategory":
        return customers.mainCategory;
      case "dbStartAt":
        return customers.dbStartAt;
      case "branch":
        return customers.branch;
      case "hq":
        return customers.hq;
      case "team":
        return customers.team;
      case "fax":
        return customers.fax;
      case "reservationReceived":
        return customers.reservationReceived;
      case "dbCompany":
        return customers.dbCompany;
      case "dbEndAt":
        return customers.dbEndAt;
      case "createdAt":
        return customers.createdAt;
      case "updatedAt":
        return customers.updatedAt;
    }
  })();
  return [direction(target), desc(customers.createdAt)];
}

// get-detail.ts 의 prev/next 컨텍스트 계산이 list 와 동일한 WHERE 를 쓰도록 export.
// 두 곳에 같은 로직을 두면 검색 필터 추가/변경 시 한 쪽만 수정해서 결과 불일치가 발생함.
export function buildWhere(filter: CustomerFilter, user: SessionUser): SQL | undefined {
  const conds: SQL[] = [];

  // admin·manager 는 전체 조회 가능 (선택된 agent 필터만 적용).
  // agent 는 본인 담당분만 보이도록 WHERE 절 강제.
  if (!canSeeAllCustomers(user)) {
    conds.push(eq(customers.agentId, user.agentId));
  } else if (filter.agentId === UNASSIGNED_AGENT_FILTER) {
    conds.push(isNull(customers.agentId));
  } else if (filter.agentId) {
    conds.push(eq(customers.agentId, filter.agentId));
  }

  if (filter.name) conds.push(ilike(customers.name, `%${filter.name}%`));
  if (filter.address) conds.push(ilike(customers.address, `%${filter.address}%`));
  if (filter.phone) {
    // 저장된 전화번호에서 하이픈·공백 제거 후 숫자 substring 매칭
    conds.push(sql`regexp_replace(coalesce(${customers.phone1}, ''), '[^0-9]', '', 'g') LIKE ${"%" + filter.phone + "%"}`);
  }
  if (filter.callResult) conds.push(eq(customers.callResult, filter.callResult));
  if (filter.rrnFront) conds.push(eq(customers.rrnFrontHash, piiHash(filter.rrnFront)!));
  if (filter.rrnBack) conds.push(eq(customers.rrnBackHash, piiHash(filter.rrnBack)!));
  if (filter.rrnFrontHash) conds.push(eq(customers.rrnFrontHash, filter.rrnFrontHash));
  if (filter.rrnBackHash) conds.push(eq(customers.rrnBackHash, filter.rrnBackHash));
  if (filter.birthYearFrom !== undefined) {
    conds.push(sql`extract(year from ${customers.birthDate}) >= ${filter.birthYearFrom}`);
  }
  if (filter.birthYearTo !== undefined) {
    conds.push(sql`extract(year from ${customers.birthDate}) <= ${filter.birthYearTo}`);
  }

  if (conds.length === 0) return undefined;
  return and(...conds);
}

export type ListedCustomer = {
  id: string;
  customerCode: string | null;
  agentId: string | null;
  agentName: string | null;
  name: string;
  birthDate: string | null;
  rrnFront: string | null;
  rrnBack: string | null;
  phone1: string | null;
  job: string | null;
  address: string | null;
  addressDetail: string | null;
  callResult: CallResult | null;
  dbProduct: string | null;
  dbPremium: string | null;
  dbHandler: string | null;
  subCategory: string | null;
  dbPolicyNo: string | null;
  dbRegisteredAt: string | null;
  mainCategory: string | null;
  dbStartAt: string | null;
  branch: string | null;
  hq: string | null;
  team: string | null;
  fax: string | null;
  reservationReceived: string | null;
  dbCompany: string | null;
  dbEndAt: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type ListResult = {
  rows: ListedCustomer[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
};

export async function listCustomers(
  filter: CustomerFilter,
  user: SessionUser,
): Promise<ListResult> {
  const where = buildWhere(filter, user);
  const offset = (filter.page - 1) * filter.perPage;
  const orderBy = buildOrderBy(filter.sort, filter.dir);

  // count 와 list 는 서로 독립적 — 병렬 실행으로 latency 절반.
  const [countResult, rows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(customers)
      .where(where ?? sql`true`),
    db
      .select({
        id: customers.id,
        customerCode: customers.customerCode,
        agentId: customers.agentId,
        agentName: users.name,
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
        branch: customers.branch,
        hq: customers.hq,
        team: customers.team,
        fax: customers.fax,
        reservationReceived: customers.reservationReceived,
        dbCompany: customers.dbCompany,
        dbEndAt: customers.dbEndAt,
        createdAt: customers.createdAt,
        updatedAt: customers.updatedAt,
      })
      .from(customers)
      .leftJoin(users, eq(customers.agentId, users.agentId))
      .where(where ?? sql`true`)
      .orderBy(...orderBy)
      .limit(filter.perPage)
      .offset(offset),
  ]);

  const count = countResult[0].count;
  const safeRows = rows.map(({ rrnBackEnc, ...row }) => ({
    ...row,
    rrnFront: null,
    rrnBack: getStoredRrnBack({ rrnBackEnc }),
  }));

  return {
    rows: safeRows as ListedCustomer[],
    total: count,
    page: filter.page,
    perPage: filter.perPage,
    totalPages: Math.max(1, Math.ceil(count / filter.perPage)),
  };
}

export async function listAgents(): Promise<Array<{ agentId: string; name: string }>> {
  // customer.agentId 로 지정 가능한 사용자 = agent + manager (관리자는 영업 라인이 아니므로 제외).
  // 매니저도 본인 고객을 가질 수 있다는 요구사항 반영.
  const rows = await db
    .select({ agentId: users.agentId, name: users.name })
    .from(users)
    .where(inArray(users.role, ["agent", "manager"]))
    .orderBy(users.agentId);
  return rows;
}

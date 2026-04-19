import { and, asc, desc, eq, ilike, SQL, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { customers, users } from "@/lib/db/schema";
import { CALL_RESULTS, type CallResult } from "@/lib/excel/column-map";
import type { SessionUser } from "@/lib/auth/rbac";
import { isSortDir, isSortKey, type SortDir, type SortKey } from "@/lib/customers/columns";
function isValidRrnFront(s: string): boolean {
  return /^\d{6}$/.test(s);
}
function isValidRrnBack(s: string): boolean {
  return /^\d{7}$/.test(s);
}

export type CustomerFilter = {
  name?: string;
  address?: string;
  phone?: string;
  callResult?: CallResult;
  agentId?: string;
  rrnFront?: string;
  rrnBack?: string;
  birthYearFrom?: number;
  birthYearTo?: number;
  sort?: SortKey;
  dir?: SortDir;
  page: number;
  perPage: number;
};

export const DEFAULT_PER_PAGE = 20;
export const MAX_PER_PAGE = 100;

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
  const rrnFrontRaw = pick("rrnFront")?.replace(/\D/g, "") ?? "";
  const rrnBackRaw = pick("rrnBack")?.replace(/\D/g, "") ?? "";
  const phoneRaw = pick("phone")?.replace(/\D/g, "") ?? "";
  const sortRaw = pick("sort");
  const dirRaw = pick("dir");
  return {
    name: pick("name")?.trim() || undefined,
    address: pick("addr")?.trim() || undefined,
    phone: phoneRaw || undefined,
    callResult: parseCallResult(pick("callResult")),
    agentId: pick("agentId")?.trim() || undefined,
    rrnFront: isValidRrnFront(rrnFrontRaw) ? rrnFrontRaw : undefined,
    rrnBack: isValidRrnBack(rrnBackRaw) ? rrnBackRaw : undefined,
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

function buildOrderBy(sort: SortKey | undefined, dir: SortDir | undefined): SQL[] {
  // 기본: DB 등록일 → createdAt 내림차순
  if (!sort) {
    return [desc(customers.dbRegisteredAt), desc(customers.createdAt)];
  }
  const direction = dir === "asc" ? asc : desc;
  // 컬럼 매핑 — 사용자 정렬 후 안정적인 tie-breaker로 createdAt DESC 추가
  const target = (() => {
    switch (sort) {
      case "agentName":
        return users.name;
      case "name":
        return customers.name;
      case "phone1":
        return customers.phone1;
      case "birthDate":
        return customers.birthDate;
      case "address":
        return customers.address;
      case "job":
        return customers.job;
      case "callResult":
        return customers.callResult;
      case "dbCompany":
        return customers.dbCompany;
      case "dbEndAt":
        return customers.dbEndAt;
    }
  })();
  return [direction(target), desc(customers.createdAt)];
}

function buildWhere(filter: CustomerFilter, user: SessionUser): SQL | undefined {
  const conds: SQL[] = [];

  if (user.role === "agent") {
    conds.push(eq(customers.agentId, user.agentId));
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
  if (filter.rrnFront) conds.push(eq(customers.rrnFront, filter.rrnFront));
  if (filter.rrnBack) conds.push(eq(customers.rrnBack, filter.rrnBack));
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
  phone1: string | null;
  job: string | null;
  address: string | null;
  callResult: CallResult | null;
  dbCompany: string | null;
  dbEndAt: string | null;
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

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(customers)
    .where(where ?? sql`true`);

  const offset = (filter.page - 1) * filter.perPage;
  const orderBy = buildOrderBy(filter.sort, filter.dir);

  const rows = await db
    .select({
      id: customers.id,
      customerCode: customers.customerCode,
      agentId: customers.agentId,
      agentName: users.name,
      name: customers.name,
      birthDate: customers.birthDate,
      phone1: customers.phone1,
      job: customers.job,
      address: customers.address,
      callResult: customers.callResult,
      dbCompany: customers.dbCompany,
      dbEndAt: customers.dbEndAt,
    })
    .from(customers)
    .leftJoin(users, eq(customers.agentId, users.agentId))
    .where(where ?? sql`true`)
    .orderBy(...orderBy)
    .limit(filter.perPage)
    .offset(offset);

  return {
    rows: rows as ListedCustomer[],
    total: count,
    page: filter.page,
    perPage: filter.perPage,
    totalPages: Math.max(1, Math.ceil(count / filter.perPage)),
  };
}

export async function listAgents(): Promise<Array<{ agentId: string; name: string }>> {
  const rows = await db
    .select({ agentId: users.agentId, name: users.name })
    .from(users)
    .where(eq(users.role, "agent"))
    .orderBy(users.agentId);
  return rows;
}

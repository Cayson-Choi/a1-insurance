import { and, eq, ilike, SQL, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { customers, users, type Customer } from "@/lib/db/schema";
import { CALL_RESULTS, type CallResult } from "@/lib/excel/column-map";
import { canSeeAllCustomers, type SessionUser } from "@/lib/auth/rbac";
import { parseFilter, buildOrderBy, type CustomerFilter } from "@/lib/customers/queries";

export type CustomerDetail = Customer & {
  agentName: string | null;
};

export type DetailContext = {
  prevId: string | null;
  nextId: string | null;
  // 이전/다음 고객이 위치한 페이지 번호 — 페이지 경계를 넘어갈 때 URL 의 ?page 갱신용.
  // 같은 페이지면 filter.page 와 동일.
  prevPage: number;
  nextPage: number;
  indexInPage: number;
  totalInPage: number;
  filter: CustomerFilter;
};

function parseCallResult(v: unknown): CallResult | undefined {
  if (typeof v !== "string") return undefined;
  return (CALL_RESULTS as readonly string[]).includes(v) ? (v as CallResult) : undefined;
}

function buildWhere(filter: CustomerFilter, user: SessionUser): SQL | undefined {
  const conds: SQL[] = [];
  // admin·manager 는 전체 조회, agent 는 본인 것만.
  if (!canSeeAllCustomers(user)) {
    conds.push(eq(customers.agentId, user.agentId));
  } else if (filter.agentId) {
    conds.push(eq(customers.agentId, filter.agentId));
  }
  if (filter.name) conds.push(ilike(customers.name, `%${filter.name}%`));
  if (filter.address) conds.push(ilike(customers.address, `%${filter.address}%`));
  if (filter.phone) {
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
  return conds.length ? and(...conds) : undefined;
}

export async function getCustomerDetail(
  id: string,
  user: SessionUser,
): Promise<CustomerDetail | null> {
  const rows = await db
    .select({
      customer: customers,
      agentName: users.name,
    })
    .from(customers)
    .leftJoin(users, eq(customers.agentId, users.agentId))
    .where(eq(customers.id, id))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  // admin·manager 는 모든 담당자의 고객 열람 가능, agent 는 본인 담당만.
  if (!canSeeAllCustomers(user) && row.customer.agentId !== user.agentId) return null;

  return {
    ...row.customer,
    agentName: row.agentName,
  };
}

export async function getDetailContext(
  id: string,
  searchParams: Record<string, string | string[] | undefined>,
  user: SessionUser,
): Promise<DetailContext> {
  const filter = parseFilter(searchParams);
  const where = buildWhere(filter, user);
  const offset = (filter.page - 1) * filter.perPage;

  // 목록 페이지의 정렬(buildOrderBy)과 동일하게 맞춰야 prev/next 가 시각 순서와 일치.
  // 하드코딩된 정렬을 쓰면 사용자가 다른 컬럼으로 정렬했을 때 findIndex 실패 → 이전/다음 둘 다 비활성화 되는 버그 발생.
  const orderBy = buildOrderBy(filter.sort, filter.dir);

  const pageRows = await db
    .select({ id: customers.id })
    .from(customers)
    .where(where ?? sql`true`)
    .orderBy(...orderBy)
    .limit(filter.perPage)
    .offset(offset);

  const idx = pageRows.findIndex((r) => r.id === id);

  // 기본: 같은 페이지 안에서 prev/next 결정
  let prevId: string | null = idx > 0 ? pageRows[idx - 1].id : null;
  let nextId: string | null =
    idx >= 0 && idx < pageRows.length - 1 ? pageRows[idx + 1].id : null;
  let prevPage = filter.page;
  let nextPage = filter.page;

  // 페이지 경계 처리: 첫 고객(idx === 0)이면서 1페이지 이상 → 직전 페이지의 마지막 고객을 prev 로
  if (idx === 0 && filter.page > 1) {
    const prevPageOffset = (filter.page - 1) * filter.perPage - 1;
    const prevRow = await db
      .select({ id: customers.id })
      .from(customers)
      .where(where ?? sql`true`)
      .orderBy(...orderBy)
      .limit(1)
      .offset(prevPageOffset);
    if (prevRow[0]) {
      prevId = prevRow[0].id;
      prevPage = filter.page - 1;
    }
  }

  // 페이지 경계 처리: 마지막 고객이면서 페이지가 꽉 참(perPage 만큼 채워짐) → 다음 페이지 첫 고객을 next 로
  if (
    idx >= 0 &&
    idx === pageRows.length - 1 &&
    pageRows.length === filter.perPage
  ) {
    const nextPageOffset = filter.page * filter.perPage;
    const nextRow = await db
      .select({ id: customers.id })
      .from(customers)
      .where(where ?? sql`true`)
      .orderBy(...orderBy)
      .limit(1)
      .offset(nextPageOffset);
    if (nextRow[0]) {
      nextId = nextRow[0].id;
      nextPage = filter.page + 1;
    }
  }

  return {
    prevId,
    nextId,
    prevPage,
    nextPage,
    indexInPage: idx,
    totalInPage: pageRows.length,
    filter,
  };
}

export { parseCallResult };

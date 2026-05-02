import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { customers, users, type Customer } from "@/lib/db/schema";
import { canSeeAllCustomers, type SessionUser } from "@/lib/auth/rbac";
import {
  parseFilter,
  buildOrderBy,
  buildWhere,
  type CustomerFilter,
} from "@/lib/customers/queries";
import { isUuid } from "@/lib/security/ids";
import { getStoredRrnBack } from "@/lib/security/pii";

export type CustomerDetail = Omit<
  Customer,
  "rrnFrontHash" | "rrnBackHash" | "rrnBackEnc"
> & {
  rrnFront: null;
  rrnBack: string | null;
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

export async function getCustomerDetail(
  id: string,
  user: SessionUser,
): Promise<CustomerDetail | null> {
  if (!isUuid(id)) return null;

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

  const { rrnFrontHash, rrnBackHash, rrnBackEnc, ...customer } = row.customer;
  void rrnFrontHash;
  void rrnBackHash;

  return {
    ...customer,
    rrnFront: null,
    rrnBack: getStoredRrnBack({ rrnBackEnc }),
    agentName: row.agentName,
  };
}

export async function getDetailContext(
  id: string,
  searchParams: Record<string, string | string[] | undefined>,
  user: SessionUser,
): Promise<DetailContext> {
  const filter = parseFilter(searchParams);
  if (!isUuid(id)) {
    return {
      prevId: null,
      nextId: null,
      prevPage: filter.page,
      nextPage: filter.page,
      indexInPage: -1,
      totalInPage: 0,
      filter,
    };
  }

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

  // 페이지 경계 처리:
  //   - 첫 고객(idx===0)이면서 1페이지 이상 → 직전 페이지의 마지막 고객을 prev
  //   - 마지막 고객이면서 페이지가 꽉 참 → 다음 페이지 첫 고객을 next
  // 두 쿼리는 서로 독립이므로 Promise.all 로 병렬 실행 — 직렬 await 비용 제거.
  const needPrevQuery = idx === 0 && filter.page > 1;
  const needNextQuery =
    idx >= 0 &&
    idx === pageRows.length - 1 &&
    pageRows.length === filter.perPage;

  if (needPrevQuery || needNextQuery) {
    const prevPromise = needPrevQuery
      ? db
          .select({ id: customers.id })
          .from(customers)
          .where(where ?? sql`true`)
          .orderBy(...orderBy)
          .limit(1)
          .offset((filter.page - 1) * filter.perPage - 1)
      : Promise.resolve([] as Array<{ id: string }>);
    const nextPromise = needNextQuery
      ? db
          .select({ id: customers.id })
          .from(customers)
          .where(where ?? sql`true`)
          .orderBy(...orderBy)
          .limit(1)
          .offset(filter.page * filter.perPage)
      : Promise.resolve([] as Array<{ id: string }>);

    const [prevRow, nextRow] = await Promise.all([prevPromise, nextPromise]);
    if (needPrevQuery && prevRow[0]) {
      prevId = prevRow[0].id;
      prevPage = filter.page - 1;
    }
    if (needNextQuery && nextRow[0]) {
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

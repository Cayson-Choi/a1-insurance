import { and, desc, eq, ilike, SQL, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { customers, users, type Customer } from "@/lib/db/schema";
import { CALL_RESULTS, type CallResult } from "@/lib/excel/column-map";
import type { SessionUser } from "@/lib/auth/rbac";
import { parseFilter, type CustomerFilter } from "@/lib/customers/queries";
import { hashPII } from "@/lib/crypto/pii";

// 클라이언트 컴포넌트로 전달되는 형태 — Uint8Array(bytea)는 직렬화 불가하므로
// 원문 대신 존재 여부만 노출한다.
export type CustomerDetail = Omit<Customer, "rrnBackEnc"> & {
  agentName: string | null;
  hasRrnBack: boolean;
};

export type DetailContext = {
  prevId: string | null;
  nextId: string | null;
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
  if (user.role === "agent") {
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
  if (filter.rrnFront) conds.push(eq(customers.rrnFrontHash, hashPII(filter.rrnFront)));
  if (filter.rrnBack) conds.push(eq(customers.rrnBackHash, hashPII(filter.rrnBack)));
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
  if (user.role === "agent" && row.customer.agentId !== user.agentId) return null;

  // rrnBackEnc(Uint8Array)은 클라이언트로 넘기지 않고 존재 여부만 노출
  const { rrnBackEnc, ...rest } = row.customer;
  return {
    ...rest,
    agentName: row.agentName,
    hasRrnBack: !!rrnBackEnc,
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

  const pageRows = await db
    .select({ id: customers.id })
    .from(customers)
    .where(where ?? sql`true`)
    .orderBy(desc(customers.dbRegisteredAt), desc(customers.createdAt))
    .limit(filter.perPage)
    .offset(offset);

  const idx = pageRows.findIndex((r) => r.id === id);

  return {
    prevId: idx > 0 ? pageRows[idx - 1].id : null,
    nextId: idx >= 0 && idx < pageRows.length - 1 ? pageRows[idx + 1].id : null,
    indexInPage: idx,
    totalInPage: pageRows.length,
    filter,
  };
}

export { parseCallResult };

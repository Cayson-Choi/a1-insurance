import { and, desc, eq, gte, lte, SQL, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { loginEvents, users } from "@/lib/db/schema";

export type LoginEventRow = {
  id: string;
  agentId: string | null;
  agentName: string | null;
  success: boolean;
  ip: string | null;
  userAgent: string | null;
  reason: string | null;
  createdAt: Date;
};

export type LoginFilter = {
  agentId?: string;
  success?: boolean;
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  page: number;
  perPage: number;
};

const DEFAULT_PER_PAGE = 30;
const MAX_PER_PAGE = 200;

export function parseLoginFilter(
  searchParams: Record<string, string | string[] | undefined>,
): LoginFilter {
  const pick = (k: string): string | undefined => {
    const v = searchParams[k];
    if (Array.isArray(v)) return v[0];
    return v;
  };
  const successRaw = pick("success");
  let success: boolean | undefined;
  if (successRaw === "true") success = true;
  else if (successRaw === "false") success = false;

  return {
    agentId: pick("agentId")?.trim() || undefined,
    success,
    from: pick("from")?.trim() || undefined,
    to: pick("to")?.trim() || undefined,
    page: parsePage(pick("page")),
    perPage: parsePerPage(pick("perPage")),
  };
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

function buildWhere(filter: LoginFilter): SQL | undefined {
  const conds: SQL[] = [];
  if (filter.agentId) conds.push(eq(loginEvents.agentId, filter.agentId));
  if (filter.success !== undefined) conds.push(eq(loginEvents.success, filter.success));
  if (filter.from && /^\d{4}-\d{2}-\d{2}$/.test(filter.from)) {
    conds.push(gte(loginEvents.createdAt, new Date(filter.from + "T00:00:00")));
  }
  if (filter.to && /^\d{4}-\d{2}-\d{2}$/.test(filter.to)) {
    // to 날짜의 23:59:59.999 까지 포함
    conds.push(lte(loginEvents.createdAt, new Date(filter.to + "T23:59:59.999")));
  }
  if (conds.length === 0) return undefined;
  return and(...conds);
}

export async function listLoginEvents(filter: LoginFilter): Promise<{
  rows: LoginEventRow[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}> {
  const where = buildWhere(filter);
  const offset = (filter.page - 1) * filter.perPage;

  const [countResult, rows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(loginEvents)
      .where(where ?? sql`true`),
    db
      .select({
        id: loginEvents.id,
        agentId: loginEvents.agentId,
        agentName: users.name,
        success: loginEvents.success,
        ip: loginEvents.ip,
        userAgent: loginEvents.userAgent,
        reason: loginEvents.reason,
        createdAt: loginEvents.createdAt,
      })
      .from(loginEvents)
      .leftJoin(users, eq(users.agentId, loginEvents.agentId))
      .where(where ?? sql`true`)
      .orderBy(desc(loginEvents.createdAt))
      .limit(filter.perPage)
      .offset(offset),
  ]);

  const count = countResult[0].count;

  return {
    rows: rows as LoginEventRow[],
    total: count,
    page: filter.page,
    perPage: filter.perPage,
    totalPages: Math.max(1, Math.ceil(count / filter.perPage)),
  };
}

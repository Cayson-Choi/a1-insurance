import { and, desc, eq, gte, lte, SQL, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { auditLogs, users, customers } from "@/lib/db/schema";

export type AuditAction = "edit" | "agent_change" | "bulk_change" | "rrn_decrypt";

export type AuditFilter = {
  action?: AuditAction;
  actorAgentId?: string;
  fromDate?: string;
  toDate?: string;
  page: number;
  perPage: number;
};

export const DEFAULT_PER_PAGE = 30;
export const MAX_PER_PAGE = 100;

const ACTIONS: readonly AuditAction[] = ["edit", "agent_change", "bulk_change", "rrn_decrypt"];

function parseAction(v: unknown): AuditAction | undefined {
  if (typeof v !== "string") return undefined;
  return (ACTIONS as readonly string[]).includes(v) ? (v as AuditAction) : undefined;
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

export function parseAuditFilter(
  sp: Record<string, string | string[] | undefined>,
): AuditFilter {
  const pick = (k: string): string | undefined => {
    const v = sp[k];
    if (Array.isArray(v)) return v[0];
    return v;
  };
  return {
    action: parseAction(pick("action")),
    actorAgentId: pick("actor")?.trim() || undefined,
    fromDate: pick("from")?.trim() || undefined,
    toDate: pick("to")?.trim() || undefined,
    page: parsePage(pick("page")),
    perPage: parsePerPage(pick("perPage")),
  };
}

export type AuditRow = {
  id: string;
  actorAgentId: string;
  actorName: string | null;
  customerId: string | null;
  customerName: string | null;
  action: AuditAction;
  before: unknown;
  after: unknown;
  createdAt: Date;
};

export type AuditListResult = {
  rows: AuditRow[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
};

export async function listAuditLogs(filter: AuditFilter): Promise<AuditListResult> {
  const conds: SQL[] = [];
  if (filter.action) conds.push(eq(auditLogs.action, filter.action));
  if (filter.actorAgentId) conds.push(eq(auditLogs.actorAgentId, filter.actorAgentId));
  if (filter.fromDate) {
    conds.push(gte(auditLogs.createdAt, new Date(`${filter.fromDate}T00:00:00`)));
  }
  if (filter.toDate) {
    conds.push(lte(auditLogs.createdAt, new Date(`${filter.toDate}T23:59:59.999`)));
  }
  const where = conds.length ? and(...conds) : undefined;

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(where ?? sql`true`);

  const offset = (filter.page - 1) * filter.perPage;

  const rows = await db
    .select({
      id: auditLogs.id,
      actorAgentId: auditLogs.actorAgentId,
      actorName: users.name,
      customerId: auditLogs.customerId,
      customerName: customers.name,
      action: auditLogs.action,
      before: auditLogs.before,
      after: auditLogs.after,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorAgentId, users.agentId))
    .leftJoin(customers, eq(auditLogs.customerId, customers.id))
    .where(where ?? sql`true`)
    .orderBy(desc(auditLogs.createdAt))
    .limit(filter.perPage)
    .offset(offset);

  return {
    rows: rows as AuditRow[],
    total: count,
    page: filter.page,
    perPage: filter.perPage,
    totalPages: Math.max(1, Math.ceil(count / filter.perPage)),
  };
}

export async function listAuditActors(): Promise<Array<{ agentId: string; name: string | null }>> {
  const rows = await db
    .selectDistinct({ agentId: auditLogs.actorAgentId, name: users.name })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorAgentId, users.agentId))
    .orderBy(auditLogs.actorAgentId);
  return rows;
}

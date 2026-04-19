import { sql, eq, asc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users, customers } from "@/lib/db/schema";

export type UserRow = {
  id: string;
  agentId: string;
  name: string;
  role: "admin" | "agent";
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
  lastSeenAt: Date | null;
  sessionsInvalidatedAt: Date | null;
  customerCount: number;
};

export async function listAllUsers(): Promise<UserRow[]> {
  const rows = await db
    .select({
      id: users.id,
      agentId: users.agentId,
      name: users.name,
      role: users.role,
      canCreate: users.canCreate,
      canEdit: users.canEdit,
      canDelete: users.canDelete,
      canExport: users.canExport,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
      lastSeenAt: users.lastSeenAt,
      sessionsInvalidatedAt: users.sessionsInvalidatedAt,
      customerCount: sql<number>`count(${customers.id})::int`,
    })
    .from(users)
    .leftJoin(customers, eq(customers.agentId, users.agentId))
    .groupBy(users.id)
    .orderBy(asc(users.role), asc(users.agentId));

  return rows as UserRow[];
}

// isOnline() 은 lib/users/online.ts 로 이동 — 클라이언트에서도 안전하게 import 가능하도록 DB 의존 모듈과 분리

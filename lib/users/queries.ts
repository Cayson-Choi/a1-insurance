import { sql, eq, asc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users, customers } from "@/lib/db/schema";

export type UserRow = {
  id: string;
  agentId: string;
  name: string;
  role: "admin" | "agent";
  canManage: boolean;
  canExport: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
  customerCount: number;
};

export async function listAllUsers(): Promise<UserRow[]> {
  const rows = await db
    .select({
      id: users.id,
      agentId: users.agentId,
      name: users.name,
      role: users.role,
      canManage: users.canManage,
      canExport: users.canExport,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
      customerCount: sql<number>`count(${customers.id})::int`,
    })
    .from(users)
    .leftJoin(customers, eq(customers.agentId, users.agentId))
    .groupBy(users.id)
    .orderBy(asc(users.role), asc(users.agentId));

  return rows as UserRow[];
}

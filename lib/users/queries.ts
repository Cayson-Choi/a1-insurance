import { sql, eq, asc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users, customers } from "@/lib/db/schema";

export type UserRow = {
  id: string;
  agentId: string;
  name: string;
  role: "admin" | "agent";
  branch: string | null;
  hq: string | null;
  team: string | null;
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
      branch: users.branch,
      hq: users.hq,
      team: users.team,
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

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

export type SessionUser = {
  agentId: string;
  role: "admin" | "agent";
  name?: string | null;
};

export type Permissions = {
  canManage: boolean;
  canExport: boolean;
};

export type SessionUserWithPerms = SessionUser & Permissions;

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.agentId) return null;
  return {
    agentId: session.user.agentId,
    role: session.user.role,
    name: session.user.name,
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** DB에서 최신 권한을 조회. admin은 항상 모두 true. */
export async function getPermissions(agentId: string): Promise<Permissions | null> {
  const row = await db.query.users.findFirst({
    where: eq(users.agentId, agentId),
    columns: {
      role: true,
      canManage: true,
      canExport: true,
    },
  });
  if (!row) return null;
  if (row.role === "admin") {
    return { canManage: true, canExport: true };
  }
  return {
    canManage: row.canManage,
    canExport: row.canExport,
  };
}

export async function requireUserWithPerms(): Promise<SessionUserWithPerms> {
  const user = await requireUser();
  const perms = await getPermissions(user.agentId);
  if (!perms) redirect("/login");
  return { ...user, ...perms };
}

export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(message = "관리자 권한이 필요합니다.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") throw new ForbiddenError();
  return user;
}

export function isAdmin(user: Pick<SessionUser, "role"> | null | undefined) {
  return user?.role === "admin";
}

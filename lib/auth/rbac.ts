import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

export type SessionUser = {
  agentId: string;
  role: "admin" | "agent";
  name?: string | null;
};

export type Permissions = {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
};

export type SessionUserWithPerms = SessionUser & Permissions;

// React.cache 로 요청당 1회만 실행되도록 메모이제이션.
// layout → page → 여러 Server Component 에서 중복 호출해도 auth() 의 session 콜백 DB 쿼리 1회로 통합.
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  if (!session?.user?.agentId) return null;
  return {
    agentId: session.user.agentId,
    role: session.user.role,
    name: session.user.name,
  };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** DB에서 최신 권한을 조회. admin은 항상 모두 true. 요청당 agentId 별로 1회 캐싱. */
export const getPermissions = cache(async (agentId: string): Promise<Permissions | null> => {
  const row = await db.query.users.findFirst({
    where: eq(users.agentId, agentId),
    columns: {
      role: true,
      canCreate: true,
      canEdit: true,
      canDelete: true,
      canExport: true,
    },
  });
  if (!row) return null;
  if (row.role === "admin") {
    return { canCreate: true, canEdit: true, canDelete: true, canExport: true };
  }
  return {
    canCreate: row.canCreate,
    canEdit: row.canEdit,
    canDelete: row.canDelete,
    canExport: row.canExport,
  };
});

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

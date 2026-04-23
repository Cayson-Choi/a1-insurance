import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import type { Role } from "@/lib/auth/roles";

// 순수 역할 유틸은 roles.ts 에서 export — 클라이언트 컴포넌트(app-header 등) 에서 안전하게 import.
// 여기(rbac.ts)는 auth()/db 를 쓰므로 서버 전용.
export type { Role } from "@/lib/auth/roles";
export {
  roleLabel,
  canSeeAllCustomers,
  canReassignAgent,
  isAdmin,
  isManager,
} from "@/lib/auth/roles";

export type SessionUser = {
  agentId: string;
  role: Role;
  name?: string | null;
};

export type Permissions = {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
  canDownloadImage: boolean;
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
      canDownloadImage: true,
    },
  });
  if (!row) return null;
  if (row.role === "admin") {
    return {
      canCreate: true,
      canEdit: true,
      canDelete: true,
      canExport: true,
      canDownloadImage: true,
    };
  }
  // manager 는 플래그 그대로 — agent 와 동일 동작.
  // 단 "전체 고객 조회" 와 "담당자 변경" 은 플래그와 무관하게 항상 허용되므로
  // 해당 판단은 canSeeAllCustomers / canReassignAgent 헬퍼에서 role 기준으로 처리한다.
  return {
    canCreate: row.canCreate,
    canEdit: row.canEdit,
    canDelete: row.canDelete,
    canExport: row.canExport,
    canDownloadImage: row.canDownloadImage,
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
  constructor(message = "권한이 필요합니다.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") {
    throw new ForbiddenError("관리자 권한이 필요합니다.");
  }
  return user;
}

/**
 * 담당자 재할당(개별/일괄) 및 전체 고객 조회 권한이 필요한 서버 액션에서 사용.
 * admin 과 manager 통과, agent 거부.
 */
export async function requireAdminOrManager(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin" && user.role !== "manager") {
    throw new ForbiddenError("관리자 또는 매니저 권한이 필요합니다.");
  }
  return user;
}

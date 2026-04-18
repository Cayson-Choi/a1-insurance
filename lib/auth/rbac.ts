import { auth } from "@/auth";
import { redirect } from "next/navigation";

export type SessionUser = {
  agentId: string;
  role: "admin" | "agent";
  name?: string | null;
};

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

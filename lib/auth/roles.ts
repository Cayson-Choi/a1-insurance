// 역할 관련 순수 유틸 — 클라이언트·서버 어디서든 import 해도 안전하도록 DB 의존성 없이 분리.
// (rbac.ts 는 auth()/db 를 import 하므로 클라이언트 번들에 끌려가면 안 됨.)

export type Role = "admin" | "manager" | "agent";

/** 역할의 한글 표기. 알림·뱃지·감사로그 표시 공용. */
export function roleLabel(role: Role): string {
  switch (role) {
    case "admin":
      return "관리자";
    case "manager":
      return "매니저";
    case "agent":
      return "담당자";
  }
}

/** 전체 담당자의 고객을 볼 수 있는가? — admin 과 manager 는 가능, agent 는 본인 것만. */
export function canSeeAllCustomers(
  user: { role: Role } | null | undefined,
): boolean {
  return user?.role === "admin" || user?.role === "manager";
}

/** 고객의 담당자(agentId) 를 재할당할 수 있는가? — admin 과 manager. */
export function canReassignAgent(
  user: { role: Role } | null | undefined,
): boolean {
  return user?.role === "admin" || user?.role === "manager";
}

export function isAdmin(user: { role: Role } | null | undefined): boolean {
  return user?.role === "admin";
}

export function isManager(user: { role: Role } | null | undefined): boolean {
  return user?.role === "manager";
}

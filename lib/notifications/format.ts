// 알림 채널 공통 포맷 유틸

export function simplifyUserAgent(ua: string | null | undefined): string {
  if (!ua) return "unknown";
  const browser =
    /Edg\//.test(ua) ? "Edge"
    : /Chrome\//.test(ua) ? "Chrome"
    : /Firefox\//.test(ua) ? "Firefox"
    : /Safari\//.test(ua) ? "Safari"
    : "Browser";
  const os =
    /Windows NT/.test(ua) ? "Windows"
    : /Mac OS X/.test(ua) ? "Mac"
    : /Android/.test(ua) ? "Android"
    : /iPhone|iPad/.test(ua) ? "iOS"
    : /Linux/.test(ua) ? "Linux"
    : "OS";
  return `${browser} / ${os}`;
}

// 서버 timezone (Vercel = UTC) 과 무관하게 항상 한국 시간으로 포맷.
// d.getHours() 등은 서버 로컬 시간이라 UTC 환경에선 9시간 빠르게 표시되는 회귀 유발 — 사용 금지.
const KST_FORMATTER = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

export function fmtKST(d: Date): string {
  // sv-SE locale 은 ISO-like "YYYY-MM-DD HH:MM:SS" 를 그대로 반환해 추가 가공 불필요.
  return KST_FORMATTER.format(d);
}

export type LoginNotifyInput = {
  agentId: string;
  name: string | null;
  role: "admin" | "manager" | "agent" | null;
  success: boolean;
  ip: string | null;
  userAgent: string | null;
  reason?: string;
  at: Date;
};

export type ForceLogoutNotifyInput = {
  actorAgentId: string;
  targetAgentId: string;
  targetName: string | null;
  at: Date;
};

export type LogoutReason = "user" | "idle";

export type LogoutNotifyInput = {
  agentId: string;
  name: string | null;
  role: "admin" | "manager" | "agent" | null;
  reason: LogoutReason;
  ip: string | null;
  userAgent: string | null;
  at: Date;
};

/** 여러 줄 plain text 메시지 생성 (Slack·Telegram 공통 사용) */
export function buildLoginText(input: LoginNotifyInput): string {
  const icon = input.success ? "🔐" : "🚨";
  const title = input.success ? "로그인 성공" : "로그인 실패";
  const roleLabel =
    input.role === "admin"
      ? "관리자"
      : input.role === "manager"
        ? "매니저"
        : "담당자";
  const who = input.success
    ? `${input.name ?? "-"} (${input.agentId}) · ${roleLabel}`
    : `시도 ID: ${input.agentId || "(미입력)"}`;
  const lines: string[] = [
    `${icon} DB-CRM ${title}`,
    `• ${who}`,
    `• IP: ${input.ip ?? "unknown"}`,
    `• 브라우저: ${simplifyUserAgent(input.userAgent)}`,
    `• 시각: ${fmtKST(input.at)}`,
  ];
  if (!input.success && input.reason) {
    lines.push(`• 사유: ${input.reason}`);
  }
  return lines.join("\n");
}

export function buildForceLogoutText(input: ForceLogoutNotifyInput): string {
  return [
    `⛔ DB-CRM 강제 로그아웃`,
    `• 대상: ${input.targetName ?? "-"} (${input.targetAgentId})`,
    `• 관리자: ${input.actorAgentId}`,
    `• 시각: ${fmtKST(input.at)}`,
  ].join("\n");
}

export function buildLogoutText(input: LogoutNotifyInput): string {
  const icon = input.reason === "idle" ? "💤" : "👋";
  const title = input.reason === "idle" ? "유휴 자동 로그아웃" : "로그아웃";
  const roleLabel =
    input.role === "admin"
      ? "관리자"
      : input.role === "manager"
        ? "매니저"
        : "담당자";
  return [
    `${icon} DB-CRM ${title}`,
    `• ${input.name ?? "-"} (${input.agentId}) · ${roleLabel}`,
    `• IP: ${input.ip ?? "unknown"}`,
    `• 브라우저: ${simplifyUserAgent(input.userAgent)}`,
    `• 시각: ${fmtKST(input.at)}`,
  ].join("\n");
}

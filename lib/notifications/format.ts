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

export function fmtKST(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
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

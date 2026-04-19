// Slack Incoming Webhook 전송 유틸 — fire-and-forget.
// env SLACK_WEBHOOK_URL 이 설정돼 있을 때만 동작. 실패해도 호출부에 영향 주지 않음.

type SlackPayload = {
  text: string;
  blocks?: unknown[];
};

const HOOK_TIMEOUT_MS = 3000;

export function simplifyUserAgent(ua: string | null | undefined): string {
  if (!ua) return "unknown";
  // Edge 먼저 체크 (Chromium 기반이라 Chrome 문자열 포함)
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

async function post(payload: SlackPayload): Promise<void> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return; // 웹훅 미설정 시 조용히 skip
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HOOK_TIMEOUT_MS);
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (e) {
    // 웹훅 실패는 로그인 자체를 막으면 안 됨
    console.warn("[slack] webhook failed:", e instanceof Error ? e.message : e);
  } finally {
    clearTimeout(timer);
  }
}

export type LoginNotifyInput = {
  agentId: string;
  name: string | null;
  role: "admin" | "agent" | null;
  success: boolean;
  ip: string | null;
  userAgent: string | null;
  reason?: string;
  at: Date;
};

function fmtKST(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

export function notifyLogin(input: LoginNotifyInput): void {
  const icon = input.success ? "🔐" : "🚨";
  const title = input.success ? "로그인 성공" : "로그인 실패";
  const who = input.success
    ? `${input.name ?? "-"} (${input.agentId}) · ${input.role === "admin" ? "관리자" : "담당자"}`
    : `시도 ID: ${input.agentId || "(미입력)"}`;
  const lines: string[] = [
    `${icon} *DB-CRM ${title}*`,
    `• ${who}`,
    `• IP: \`${input.ip ?? "unknown"}\``,
    `• 브라우저: ${simplifyUserAgent(input.userAgent)}`,
    `• 시각: ${fmtKST(input.at)}`,
  ];
  if (!input.success && input.reason) {
    lines.push(`• 사유: ${input.reason}`);
  }
  // 비동기 fire-and-forget
  void post({ text: lines.join("\n") });
}

export function notifyForceLogout(input: {
  actorAgentId: string;
  targetAgentId: string;
  targetName: string | null;
  at: Date;
}): void {
  const lines = [
    `⛔ *DB-CRM 강제 로그아웃*`,
    `• 대상: ${input.targetName ?? "-"} (${input.targetAgentId})`,
    `• 관리자: ${input.actorAgentId}`,
    `• 시각: ${fmtKST(input.at)}`,
  ];
  void post({ text: lines.join("\n") });
}

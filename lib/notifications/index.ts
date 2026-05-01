// 알림 디스패처 — 구성된 채널(Slack · Telegram) 모두에 발송.
// 하나도 설정 안 돼 있으면 조용히 skip. 실패해도 호출부에 예외 전파하지 않음.

import { sendSlack } from "@/lib/notifications/slack";
import { sendTelegram } from "@/lib/notifications/telegram";
import {
  buildForceLogoutText,
  buildLoginText,
  buildLogoutText,
  simplifyUserAgent,
  type ForceLogoutNotifyInput,
  type LoginNotifyInput,
  type LogoutNotifyInput,
} from "@/lib/notifications/format";

export { simplifyUserAgent };
export type { LoginNotifyInput, ForceLogoutNotifyInput, LogoutNotifyInput };

function dispatch(text: string): void {
  // 양 채널 병행 — Promise.allSettled 로 하나가 느려도 다른 쪽 영향 X
  void Promise.allSettled([sendSlack(text), sendTelegram(text)]);
}

export function notifyLogin(input: LoginNotifyInput): void {
  dispatch(buildLoginText(input));
}

export function notifyForceLogout(input: ForceLogoutNotifyInput): void {
  dispatch(buildForceLogoutText(input));
}

export function notifyLogout(input: LogoutNotifyInput): void {
  dispatch(buildLogoutText(input));
}

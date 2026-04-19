// 순수 판정 함수 — DB import 없이 클라이언트에서도 안전하게 사용 가능

/** last_seen_at 이 N분 내면 "접속 중"으로 판정. sessions_invalidated_at 이 그 이후면 취소. */
export function isOnline(
  lastSeenAt: Date | string | null | undefined,
  sessionsInvalidatedAt: Date | string | null | undefined,
  withinMinutes = 5,
): boolean {
  if (!lastSeenAt) return false;
  const lastSeenMs =
    lastSeenAt instanceof Date
      ? lastSeenAt.getTime()
      : new Date(lastSeenAt).getTime();
  if (!Number.isFinite(lastSeenMs)) return false;
  if (sessionsInvalidatedAt) {
    const invMs =
      sessionsInvalidatedAt instanceof Date
        ? sessionsInvalidatedAt.getTime()
        : new Date(sessionsInvalidatedAt).getTime();
    if (Number.isFinite(invMs) && invMs >= lastSeenMs) return false;
  }
  const diffMs = Date.now() - lastSeenMs;
  return diffMs <= withinMinutes * 60_000;
}

"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { logoutAction } from "@/lib/auth/actions";

const IDLE_LIMIT_MS = 30 * 60 * 1000;
const WARN_BEFORE_MS = 5 * 60 * 1000;
const ACTIVITY_EVENTS = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const;

export function IdleTimeout() {
  const [warningVisible, setWarningVisible] = useState(false);
  // 0 으로 초기화 — 실제 값은 mount 직후 useEffect 의 scheduleTimers/resetIdle 에서 세팅.
  // 초기값으로 Date.now() 를 호출하면 render 중 impure call 위반.
  const lastActivityRef = useRef<number>(0);
  const warnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    function clearTimers() {
      if (warnTimerRef.current) clearTimeout(warnTimerRef.current);
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    }

    function scheduleTimers() {
      clearTimers();
      warnTimerRef.current = setTimeout(() => {
        setWarningVisible(true);
      }, IDLE_LIMIT_MS - WARN_BEFORE_MS);

      logoutTimerRef.current = setTimeout(() => {
        toast.error("유휴 시간 초과로 로그아웃 되었습니다.", { duration: 4000 });
        startTransition(() => {
          // "idle" 사유 전달 — Slack/Telegram 알림에서 사용자 자발 로그아웃과 구분 표시.
          logoutAction("idle");
        });
      }, IDLE_LIMIT_MS);
    }

    function resetIdle() {
      lastActivityRef.current = Date.now();
      if (warningVisible) setWarningVisible(false);
      scheduleTimers();
    }

    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, resetIdle, { passive: true }));
    scheduleTimers();

    return () => {
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, resetIdle));
      clearTimers();
    };
  }, [warningVisible]);

  if (!warningVisible) return null;

  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      className="fixed inset-x-0 top-16 z-50 mx-auto w-fit rounded-md border border-brand/40 bg-brand-muted px-4 py-3 text-sm text-foreground shadow-lg"
    >
      <div className="flex items-center gap-3">
        <span className="font-medium">
          5분 뒤 자동 로그아웃됩니다. 계속 사용하시려면 화면을 클릭하세요.
        </span>
      </div>
    </div>
  );
}

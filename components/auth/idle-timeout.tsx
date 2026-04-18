"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { logoutAction } from "@/lib/auth/actions";

const IDLE_LIMIT_MS = 30 * 60 * 1000;
const WARN_BEFORE_MS = 5 * 60 * 1000;
const ACTIVITY_EVENTS = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const;

export function IdleTimeout() {
  const [warningVisible, setWarningVisible] = useState(false);
  const lastActivityRef = useRef<number>(Date.now());
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
          logoutAction();
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

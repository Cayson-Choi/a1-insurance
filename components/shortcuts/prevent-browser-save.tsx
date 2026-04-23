"use client";

import { useEffect } from "react";

/**
 * Ctrl+S (macOS: Cmd+S) 의 브라우저 기본 동작(현재 HTML 페이지를 파일로 저장) 을
 * 앱 전역에서 차단.
 *
 * 배경: 고객 상세 팝업(DetailForm) 은 자체 keydown capture 리스너에서
 * Ctrl+S → 폼 submit 으로 동작하지만, 팝업이 열리지 않은 화면(로그인 / 목록)에서는
 * 리스너가 없어 브라우저 기본 동작으로 "페이지 저장" 다이얼로그가 떴다.
 *
 * 이 컴포넌트는 capture 단계에서 preventDefault 만 수행 — 이벤트 전파(stopPropagation)
 * 는 하지 않으므로 팝업 내부 submit 트리거는 그대로 동작한다.
 */
export function PreventBrowserSave() {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const modPressed = e.ctrlKey || e.metaKey;
      if (!modPressed) return;
      // Shift+Ctrl+S 등 다른 조합은 건드리지 않음 — 순수 Save 단축키만.
      if (e.shiftKey || e.altKey) return;
      if (e.key.toLowerCase() !== "s") return;
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
  return null;
}

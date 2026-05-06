// Next.js 16: proxy.ts (middleware.ts → proxy.ts 로 rename)
// Auth.js 프록시 — auth.config.ts 의 `authorized` 콜백이 모든 요청에 대해 실행됨.
// 개별 페이지/API 의 requireUser() 와 이중 방어(defense-in-depth).
//
// proxy.ts 는 Node.js 런타임에서 실행되므로 DB 접근 포함 auth.ts 를 직접 import 가능.

import { auth } from "@/auth";

export const proxy = auth;

export const config = {
  // 제외 대상:
  //   - api/auth : Auth.js 자체 핸들러(로그인 콜백 등) — 비인증 상태에서 접근 필요
  //   - _next    : 정적 자원·내부 경로
  //   - favicon·이미지 확장자
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};

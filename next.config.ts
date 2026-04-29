import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 프로덕션 빌드에서 console.log 류 제거 — error/warn 은 보존해 운영 디버깅 유지.
  compiler: {
    removeConsole: process.env.NODE_ENV === "production"
      ? { exclude: ["error", "warn"] }
      : false,
  },
  // OG 이미지 등 정적 자산을 AVIF/WebP 로 자동 변환.
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // 보안 헤더 — clickjacking·MIME sniffing·referrer leakage·downgrade attack 방어.
  // HSTS: 한 번 https 로 들어온 클라이언트는 1년간 강제 https. preload 디렉티브 미포함 — 사전등록 절차 거치지 않은 도메인이 preload 리스트에 들어가는 것 방지.
  // CSP 는 Next.js 의 nonce 기반 인라인 스크립트 처리(폰트, hydration) 와 충돌 가능성이 있어 보고 모드(Report-Only) 또는 별도 PR 로 도입 권장.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          { key: "X-DNS-Prefetch-Control", value: "off" },
        ],
      },
    ];
  },
};

export default nextConfig;

import type { NextConfig } from "next";

// Content-Security-Policy: 우선 Report-Only 로 도입.
// Next.js 16 hydration 인라인·Pretendard CDN·이미지(blob:) 까지 모두 허용해 위반 0 인지 운영에서 관찰한 뒤
// 추후 별도 PR 에서 enforce 로 승격 + nonce 기반 strict-dynamic 으로 전환.
// 리포트 수집은 추가 인프라가 필요해 일단 헤더만 두고, 브라우저 콘솔에서 위반을 잡는 형태.
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  // hydration·Tailwind JIT inline style 호환 위해 'unsafe-inline'. 추후 nonce 로 교체.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
  "font-src 'self' data: https://cdn.jsdelivr.net",
  // OG 이미지·html-to-image 캡처용 blob: 허용. 외부 이미지는 회사 CDN 만.
  "img-src 'self' data: blob: https://cdn.jsdelivr.net",
  // fetch · server action · 알림 웹훅(서버에서만 호출되지만 보수적으로 self).
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

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
          { key: "Content-Security-Policy-Report-Only", value: CSP_REPORT_ONLY },
        ],
      },
    ];
  },
};

export default nextConfig;

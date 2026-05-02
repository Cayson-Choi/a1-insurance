import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const CSP = [
  "default-src 'self'",
  // hydration·Tailwind JIT inline style 호환 위해 'unsafe-inline'. 추후 nonce 로 교체.
  isProd
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
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
  isProd ? "upgrade-insecure-requests" : "",
].filter(Boolean).join("; ");

const nextConfig: NextConfig = {
  // 프로덕션 빌드에서 console.log 류 제거 — error/warn 은 보존해 운영 디버깅 유지.
  compiler: {
    removeConsole: isProd
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
          {
            key: isProd
              ? "Content-Security-Policy"
              : "Content-Security-Policy-Report-Only",
            value: CSP,
          },
        ],
      },
    ];
  },
};

export default nextConfig;

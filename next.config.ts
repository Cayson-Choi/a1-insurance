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
  // 보안 헤더 — clickjacking·MIME sniffing·referrer leakage 방어.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;

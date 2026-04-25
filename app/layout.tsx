import type { Metadata, Viewport } from "next";
import { Toaster } from "@/components/ui/sonner";
import { PreventBrowserSave } from "@/components/shortcuts/prevent-browser-save";
import "./globals.css";

// OG 이미지·링크 프리뷰 용 절대 URL 기준.
// 우선순위: NEXT_PUBLIC_SITE_URL (운영 도메인 지정) → VERCEL_URL (Preview 자동 주입) → localhost
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

const TITLE = "DB-CRM 고객·데이터 관리";
const DESCRIPTION = "DB-CRM — Customer & Data Management System";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: TITLE,
    template: "%s · DB-CRM",
  },
  description: DESCRIPTION,
  applicationName: "DB-CRM",
  robots: { index: false, follow: false },
  openGraph: {
    type: "website",
    siteName: "DB-CRM",
    title: TITLE,
    description: DESCRIPTION,
    url: siteUrl,
    locale: "ko_KR",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "DB-CRM — Customer & Data Management",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {/* 전역: Ctrl+S/Cmd+S 의 "페이지 저장" 브라우저 기본 동작 차단.
            팝업 상세 폼의 내부 단축키 핸들러는 그대로 동작(전파 막지 않음). */}
        <PreventBrowserSave />
        {children}
        <Toaster richColors position="top-right" closeButton />
      </body>
    </html>
  );
}

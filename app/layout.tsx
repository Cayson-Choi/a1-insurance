import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "에이원 고객관리 시스템",
    template: "%s · 에이원 고객관리",
  },
  description:
    "에이원금융판매(주) 보험 고객 상담·관리 시스템. ALWAYS WITH CUSTOMERS.",
  applicationName: "A-ONE CRM",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
        <Toaster richColors position="top-right" closeButton />
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "JK-CRM 고객·데이터 관리",
    template: "%s · JK-CRM",
  },
  description: "JK-CRM — Customer & Data Management System",
  applicationName: "JK-CRM",
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

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "로그인",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh flex flex-col bg-gradient-to-br from-brand-muted/40 via-background to-background">
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        {children}
      </main>
    </div>
  );
}

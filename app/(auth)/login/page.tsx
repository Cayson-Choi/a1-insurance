import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/rbac";
import { Logo } from "@/components/brand/logo";
import { LoginForm } from "@/components/auth/login-form";
import { COMPANY } from "@/lib/company";

export const metadata: Metadata = {
  title: "로그인",
};

type SearchParams = Promise<{ next?: string }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await getSessionUser();
  if (user) redirect("/customers");

  const { next } = await searchParams;

  return (
    <div className="w-full max-w-md">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <Logo variant="stacked" priority />
        <div className="space-y-1">
          <p className="text-xs font-semibold tracking-[0.22em] text-brand-accent/80">
            {COMPANY.slogan}
          </p>
          <h1 className="text-xl font-semibold text-foreground">
            {COMPANY.appName}
          </h1>
          <p className="text-sm text-muted-foreground">
            담당자ID와 비밀번호로 로그인 해주세요.
          </p>
        </div>
      </div>

      <div className="rounded-xl border bg-card shadow-sm p-6 md:p-8">
        <LoginForm next={next} />
      </div>

      <footer className="mt-8 space-y-1 text-center text-xs text-muted-foreground">
        <div>{COMPANY.tagline}</div>
        <div>© {new Date().getFullYear()} {COMPANY.nameEn}. All rights reserved.</div>
      </footer>
    </div>
  );
}

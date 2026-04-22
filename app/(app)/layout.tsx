import { requireUser } from "@/lib/auth/rbac";
import { AppHeader } from "@/components/brand/app-header";
import { AppFooter } from "@/components/brand/app-footer";
import { IdleTimeout } from "@/components/auth/idle-timeout";

export default async function AppLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="min-h-dvh flex flex-col">
      <AppHeader user={user} />
      {/* 고객 목록 28컬럼 테이블이 울트라와이드(21:9, ~3440px)까지 전부 펼쳐지도록
         폭 제한을 풀어둠. 개별 하위 페이지(admin 등)는 자체 레이아웃에서 max-w 적용. */}
      <main className="flex-1 mx-auto w-full px-3 md:px-6 py-4 md:py-6">
        {children}
      </main>
      <AppFooter />
      <IdleTimeout />
      {modal}
    </div>
  );
}

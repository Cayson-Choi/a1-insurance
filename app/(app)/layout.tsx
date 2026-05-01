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
    <div className="h-dvh flex flex-col">
      <AppHeader user={user} />
      {/* 고객 목록 28컬럼 테이블이 울트라와이드(21:9, ~3440px)까지 전부 펼쳐지도록
         폭 제한을 풀어둠. 개별 하위 페이지(admin 등)는 자체 레이아웃에서 max-w 적용.
         min-h-0 — flex 자식이 컨테이너보다 커지지 않도록 허용해 자식의 overflow-auto 가
         viewport 안에서만 스크롤되게 한다(고객 목록의 sticky 헤더 동작 핵심). */}
      <main className="flex-1 min-h-0 mx-auto w-full px-3 md:px-6 py-4 md:py-6">
        {children}
      </main>
      <AppFooter />
      <IdleTimeout />
      {modal}
    </div>
  );
}

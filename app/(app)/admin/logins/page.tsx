import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth/rbac";
import { listLoginEvents, parseLoginFilter } from "@/lib/logins/queries";
import { listAllUsers } from "@/lib/users/queries";
import { LoginFilterBar } from "@/components/admin/login-filter";
import { LoginHistoryTable } from "@/components/admin/login-history-table";
import { LoginHistoryPagination } from "@/components/admin/login-history-pagination";

export const metadata: Metadata = {
  title: "로그인 이력",
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminLoginsPage({ searchParams }: PageProps) {
  await requireAdmin();
  const sp = await searchParams;
  const filter = parseLoginFilter(sp);

  const [list, users] = await Promise.all([listLoginEvents(filter), listAllUsers()]);
  const actors = users.map((u) => ({ agentId: u.agentId, name: u.name }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">로그인 이력</h1>
        <p className="text-sm text-muted-foreground">
          로그인 성공·실패 기록입니다. 특정 사용자·기간·결과별로 필터할 수 있으며, 감사 증거로 활용 가능합니다.
        </p>
      </div>

      <Suspense>
        <LoginFilterBar actors={actors} />
      </Suspense>

      <LoginHistoryTable rows={list.rows} />

      <Suspense>
        <LoginHistoryPagination
          page={list.page}
          totalPages={list.totalPages}
          total={list.total}
        />
      </Suspense>
    </div>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth/rbac";
import { listAuditLogs, listAuditActors, parseAuditFilter } from "@/lib/audit/queries";
import { AuditFilterBar } from "@/components/admin/audit-filter";
import { AuditTable } from "@/components/admin/audit-table";
import { AuditPagination } from "@/components/admin/audit-pagination";
import { DeleteAllAuditLogsDialog } from "@/components/admin/delete-all-audit-logs-dialog";

export const metadata: Metadata = {
  title: "변경 이력",
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminAuditPage({ searchParams }: PageProps) {
  await requireAdmin();
  const sp = await searchParams;
  const filter = parseAuditFilter(sp);

  const [list, actors] = await Promise.all([listAuditLogs(filter), listAuditActors()]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">변경 이력</h1>
          <p className="text-sm text-muted-foreground">
            고객 편집 · 담당자 변경 · 주민번호 조회 등 모든 민감 작업 기록입니다. 감사·분쟁 대응 시 참고하세요.
          </p>
        </div>
        <DeleteAllAuditLogsDialog />
      </div>

      <Suspense>
        <AuditFilterBar actors={actors} />
      </Suspense>

      <AuditTable rows={list.rows} />

      <Suspense>
        <AuditPagination
          page={list.page}
          totalPages={list.totalPages}
          total={list.total}
        />
      </Suspense>
    </div>
  );
}

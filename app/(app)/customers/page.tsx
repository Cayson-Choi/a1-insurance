import type { Metadata } from "next";
import { Suspense } from "react";
import { Download } from "lucide-react";
import { requireUserWithPerms } from "@/lib/auth/rbac";
import { listCustomers, listAgents, parseFilter } from "@/lib/customers/queries";
import { SearchBar } from "@/components/customers/search-bar";
import { ListTable } from "@/components/customers/list-table";
import { Pagination } from "@/components/customers/pagination";

export const metadata: Metadata = {
  title: "고객 목록",
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CustomersPage({ searchParams }: PageProps) {
  const user = await requireUserWithPerms();
  const params = await searchParams;
  const filter = parseFilter(params);
  const isAdmin = user.role === "admin";
  const canExport = user.canExport;

  const [list, agents] = await Promise.all([
    listCustomers(filter, user),
    isAdmin ? listAgents() : Promise.resolve([]),
  ]);

  const preservedQuery = new URLSearchParams(
    Object.fromEntries(
      Object.entries(params).flatMap(([k, v]) => {
        if (v === undefined) return [];
        if (Array.isArray(v)) return v.length ? [[k, v[0]]] : [];
        return [[k, v]];
      }),
    ),
  ).toString();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">고객 목록</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? "전체 고객 DB를 조회·편집할 수 있습니다."
              : "본인에게 배정된 고객 목록입니다."}
          </p>
        </div>
        {canExport ? (
          <a
            href={`/api/customers/export${preservedQuery ? `?${preservedQuery}` : ""}`}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border text-sm font-medium hover:bg-accent transition"
            target="_blank"
            rel="noreferrer"
            title="현재 검색 조건 그대로 엑셀 다운로드"
          >
            <Download className="h-4 w-4" />
            엑셀 다운로드
          </a>
        ) : null}
      </div>

      <Suspense>
        <SearchBar agents={agents} showAgentFilter={isAdmin} />
      </Suspense>

      <ListTable
        rows={list.rows}
        showAgentColumn={isAdmin}
        preservedQuery={preservedQuery}
        canUnmaskPhone={true}
        canBulkEdit={isAdmin}
        agents={agents}
      />

      <Suspense>
        <Pagination
          page={list.page}
          totalPages={list.totalPages}
          total={list.total}
        />
      </Suspense>
    </div>
  );
}

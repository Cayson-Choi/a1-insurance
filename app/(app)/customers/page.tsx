import type { Metadata } from "next";
import { Suspense } from "react";
import { Download } from "lucide-react";
import {
  requireUserWithPerms,
  canSeeAllCustomers,
  canReassignAgent,
  isAdmin as isAdminRole,
} from "@/lib/auth/rbac";
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
  // 전체 조회 가능 여부 — admin 과 manager 는 다른 담당자 고객도 보임.
  const canSeeAll = canSeeAllCustomers(user);
  // 담당자 재할당(개별+일괄) 가능 여부 — admin 과 manager.
  const canReassign = canReassignAgent(user);
  // DB 등록일 일괄 변경은 관리자 전용(매니저 기본 권한에 포함 안 됨).
  const canBulkDate = isAdminRole(user);
  const canExport = user.canExport;
  const canDelete = user.canDelete;

  const [list, agents] = await Promise.all([
    listCustomers(filter, user),
    // 담당자 필터 드롭다운은 "전체 조회 가능" 역할일 때만 의미 있음.
    canSeeAll ? listAgents() : Promise.resolve([]),
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
    // h-full + flex-col + min-h-0 — 페이지 높이를 viewport 에 고정해 page-level 스크롤 제거.
    // ListTable 의 내부 스크롤 컨테이너가 sticky 헤더와 가로 스크롤바를 viewport 에 붙여 둔다.
    <div className="h-full flex flex-col gap-5 min-h-0">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">고객 목록</h1>
          <p className="text-sm text-muted-foreground">
            {canSeeAll
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
        <SearchBar agents={agents} showAgentFilter={canSeeAll} />
      </Suspense>

      {/* flex-1 min-h-0 — 남는 세로 공간을 모두 차지해 내부 스크롤이 동작하도록. */}
      <ListTable
        rows={list.rows}
        showAgentColumn={canSeeAll}
        preservedQuery={preservedQuery}
        canUnmaskPhone={true}
        canBulkReassign={canReassign}
        canBulkDate={canBulkDate}
        canBulkDelete={canDelete}
        agents={agents}
        sort={filter.sort ?? null}
        dir={filter.dir ?? "asc"}
      />

      <Suspense>
        <div className="shrink-0">
          <Pagination
            page={list.page}
            totalPages={list.totalPages}
            total={list.total}
            perPage={list.perPage}
          />
        </div>
      </Suspense>
    </div>
  );
}

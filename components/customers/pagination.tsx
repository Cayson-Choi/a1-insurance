"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PER_PAGE_OPTIONS, DEFAULT_PER_PAGE } from "@/lib/customers/page-config";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

const STORAGE_KEY = "dbcrm.customers.perPage";

function readStoredPerPage(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    return (PER_PAGE_OPTIONS as readonly number[]).includes(n) ? n : null;
  } catch {
    return null;
  }
}

function writeStoredPerPage(n: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(n));
  } catch {
    /* localStorage 불가 환경 — 무시 */
  }
}

export function Pagination({
  page,
  totalPages,
  total,
  perPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  perPage: number;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  // localStorage 영속화: URL 에 ?perPage 가 없을 때만 저장된 값을 적용.
  // 사용자가 명시적으로 URL 을 공유받았을 땐 그 값을 우선시.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const urlVal = sp?.get("perPage");
    if (urlVal) {
      // URL 에 명시된 값을 localStorage 에도 동기화 (다음 진입 시 동일 적용)
      writeStoredPerPage(perPage);
      return;
    }
    const stored = readStoredPerPage();
    if (stored && stored !== perPage) {
      const next = new URLSearchParams(sp ?? undefined);
      next.set("perPage", String(stored));
      // URL 에 명시적 ?page=N 이 있으면 그 의도를 존중 (예: 팝업 닫기 후 복귀,
      // 공유 링크). perPage 자동 채택이 사용자가 의도한 페이지를 흔들면 안 됨.
      // 명시적 page 가 없을 때만 위치 보존 재계산 적용.
      if (!sp?.get("page")) {
        const oldOffset = (page - 1) * perPage;
        const newPage = Math.floor(oldOffset / stored) + 1;
        if (newPage <= 1) next.delete("page");
        else next.set("page", String(newPage));
      }
      router.replace(`/customers?${next.toString()}`);
    }
    // page 변화에는 반응하지 않음 — perPage 첫 mount 시점에만 동기화 시도.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function buildPageHref(p: number) {
    const next = new URLSearchParams(sp ?? undefined);
    if (p <= 1) next.delete("page");
    else next.set("page", String(p));
    const qs = next.toString();
    return `/customers${qs ? `?${qs}` : ""}`;
  }

  function changePerPage(newPerPage: number) {
    if (newPerPage === perPage) return;
    // 위치 보존 재계산: 현재 보고 있던 첫 번째 고객(=오프셋)을 새 perPage 페이지로 변환.
    const oldOffset = (page - 1) * perPage;
    const newPage = Math.floor(oldOffset / newPerPage) + 1;
    const next = new URLSearchParams(sp ?? undefined);
    if (newPerPage === DEFAULT_PER_PAGE) {
      // 기본값이면 URL 을 깔끔하게 유지하기 위해 파라미터 삭제 — but 영속화를 위해 둘 수도.
      // 현재 사용자 의도가 "20 으로 되돌리기" 라면 명시적 ?perPage=20 보다 삭제가 깔끔.
      next.delete("perPage");
    } else {
      next.set("perPage", String(newPerPage));
    }
    if (newPage <= 1) next.delete("page");
    else next.set("page", String(newPage));
    writeStoredPerPage(newPerPage);
    router.push(`/customers?${next.toString()}`);
  }

  const prev = Math.max(1, page - 1);
  const next = Math.min(totalPages, page + 1);

  const windowStart = Math.max(1, page - 2);
  const windowEnd = Math.min(totalPages, windowStart + 4);

  const pages: number[] = [];
  for (let p = windowStart; p <= windowEnd; p++) pages.push(p);

  return (
    <nav
      className="flex items-center justify-between gap-3 pt-4 flex-wrap max-md:flex-col max-md:items-stretch"
      aria-label="페이지 이동"
    >
      <div className="text-sm text-muted-foreground max-md:w-full">
        총 <span className="font-semibold text-foreground">{total.toLocaleString("ko-KR")}</span>건 · {page} / {totalPages} 페이지
      </div>

      <div className="flex items-center gap-3 max-md:w-full max-md:overflow-x-auto max-md:pb-1">
        {/* 페이지당 표시 개수 — localStorage 영속화 */}
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground max-md:shrink-0 max-md:whitespace-nowrap">
          <span>페이지당</span>
          <Select
            value={String(perPage)}
            onValueChange={(v) => v && changePerPage(Number(v))}
          >
            <SelectTrigger className="h-9 min-w-[72px] tabular-nums">
              <span>{perPage}</span>
            </SelectTrigger>
            <SelectContent>
              {PER_PAGE_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)} className="tabular-nums">
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span>건</span>
        </div>

        <div className="flex items-center gap-1 max-md:shrink-0">
          {/* 첫 페이지로 점프 — page=1 일 때 비활성 */}
          <Link
            href={buildPageHref(1)}
            aria-disabled={page <= 1}
            aria-label="첫 페이지"
            title="첫 페이지"
            tabIndex={page <= 1 ? -1 : 0}
            className={cn(
              "inline-flex h-9 w-9 items-center justify-center rounded-md border text-sm hover:bg-accent",
              page <= 1 && "pointer-events-none opacity-40",
            )}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Link>
          <Link
            href={buildPageHref(prev)}
            aria-disabled={page <= 1}
            aria-label="이전 페이지"
            title="이전 페이지"
            tabIndex={page <= 1 ? -1 : 0}
            className={cn(
              "inline-flex h-9 w-9 items-center justify-center rounded-md border text-sm hover:bg-accent",
              page <= 1 && "pointer-events-none opacity-40",
            )}
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          {pages.map((p) => (
            <Link
              key={p}
              href={buildPageHref(p)}
              className={cn(
                "inline-flex h-9 min-w-9 px-2 items-center justify-center rounded-md border text-sm font-medium hover:bg-accent",
                p === page && "bg-brand text-brand-foreground border-brand hover:bg-brand-hover",
              )}
            >
              {p}
            </Link>
          ))}
          <Link
            href={buildPageHref(next)}
            aria-disabled={page >= totalPages}
            aria-label="다음 페이지"
            title="다음 페이지"
            tabIndex={page >= totalPages ? -1 : 0}
            className={cn(
              "inline-flex h-9 w-9 items-center justify-center rounded-md border text-sm hover:bg-accent",
              page >= totalPages && "pointer-events-none opacity-40",
            )}
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
          {/* 마지막 페이지로 점프 — 마지막 페이지일 때 비활성 */}
          <Link
            href={buildPageHref(totalPages)}
            aria-disabled={page >= totalPages}
            aria-label="마지막 페이지"
            title="마지막 페이지"
            tabIndex={page >= totalPages ? -1 : 0}
            className={cn(
              "inline-flex h-9 w-9 items-center justify-center rounded-md border text-sm hover:bg-accent",
              page >= totalPages && "pointer-events-none opacity-40",
            )}
          >
            <ChevronsRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </nav>
  );
}

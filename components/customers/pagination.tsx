"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Pagination({
  page,
  totalPages,
  total,
}: {
  page: number;
  totalPages: number;
  total: number;
}) {
  const sp = useSearchParams();

  function buildHref(p: number) {
    const next = new URLSearchParams(sp);
    if (p <= 1) next.delete("page");
    else next.set("page", String(p));
    const qs = next.toString();
    return `/customers${qs ? `?${qs}` : ""}`;
  }

  const prev = Math.max(1, page - 1);
  const next = Math.min(totalPages, page + 1);

  const windowStart = Math.max(1, page - 2);
  const windowEnd = Math.min(totalPages, windowStart + 4);

  const pages: number[] = [];
  for (let p = windowStart; p <= windowEnd; p++) pages.push(p);

  return (
    <nav
      className="flex items-center justify-between gap-3 pt-4"
      aria-label="페이지 이동"
    >
      <div className="text-sm text-muted-foreground">
        총 <span className="font-semibold text-foreground">{total.toLocaleString("ko-KR")}</span>건 · {page} / {totalPages} 페이지
      </div>

      <div className="flex items-center gap-1">
        <Link
          href={buildHref(prev)}
          aria-disabled={page <= 1}
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
            href={buildHref(p)}
            className={cn(
              "inline-flex h-9 min-w-9 px-2 items-center justify-center rounded-md border text-sm font-medium hover:bg-accent",
              p === page && "bg-brand text-brand-foreground border-brand hover:bg-brand-hover",
            )}
          >
            {p}
          </Link>
        ))}
        <Link
          href={buildHref(next)}
          aria-disabled={page >= totalPages}
          tabIndex={page >= totalPages ? -1 : 0}
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-md border text-sm hover:bg-accent",
            page >= totalPages && "pointer-events-none opacity-40",
          )}
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </nav>
  );
}

import { cn } from "@/lib/utils";
import type { CallResult } from "@/lib/excel/column-map";

const STYLE: Record<CallResult, string> = {
  예약: "bg-brand/15 text-[#b4610e] border-brand/30",
  부재: "bg-slate-100 text-slate-700 border-slate-200",
  가망: "bg-emerald-50 text-emerald-700 border-emerald-200",
  거절: "bg-rose-50 text-rose-700 border-rose-200",
  결번: "bg-zinc-100 text-zinc-500 border-zinc-200",
  민원: "bg-amber-50 text-amber-800 border-amber-300",
};

export function CallResultBadge({
  value,
  className,
}: {
  value: CallResult | null | undefined;
  className?: string;
}) {
  if (!value) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground",
          className,
        )}
      >
        미분류
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        STYLE[value],
        className,
      )}
    >
      {value}
    </span>
  );
}

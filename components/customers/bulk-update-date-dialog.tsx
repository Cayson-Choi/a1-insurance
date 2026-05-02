"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { toast } from "sonner";
import { CalendarClock, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { bulkUpdateDbRegisteredAtAction } from "@/lib/customers/actions";

export function BulkUpdateDateDialog({
  open,
  onOpenChange,
  selectedCount,
  selectedIds,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  selectedCount: number;
  selectedIds: string[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [date, setDate] = useState<string>("");
  const [clearMode, setClearMode] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    const target = clearMode ? null : date;
    if (!clearMode && !date) {
      toast.error("날짜를 선택하세요.");
      return;
    }
    startTransition(async () => {
      const res = await bulkUpdateDbRegisteredAtAction(selectedIds, target);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const label = res.newDate === null ? "비움" : res.newDate;
      toast.success(`${res.updated}건의 DB 등록일을 ${label}(으)로 변경했습니다.`, {
        duration: 5000,
      });
      onOpenChange(false);
      setDate("");
      setClearMode(false);
      onDone();
      window.setTimeout(() => router.refresh(), 0);
    });
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-open:animate-in data-open:fade-in-0" />
        <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-popover text-popover-foreground shadow-2xl ring-1 ring-foreground/10 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95">
          <div className="flex items-center gap-2 border-b px-5 py-3">
            <CalendarClock className="h-5 w-5 text-brand" />
            <DialogPrimitive.Title className="text-base font-semibold">
              DB 등록일 일괄 변경
            </DialogPrimitive.Title>
          </div>
          <div className="space-y-3 px-5 py-4 text-sm">
            <div className="rounded-md bg-muted/50 px-3 py-2">
              선택된 고객: <b>{selectedCount}</b>건
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                새 DB 등록일<span className="ml-1 text-destructive">*</span>
              </Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  if (e.target.value) setClearMode(false);
                }}
                className="h-10 tabular-nums"
                disabled={clearMode}
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={clearMode}
                onChange={(e) => {
                  setClearMode(e.target.checked);
                  if (e.target.checked) setDate("");
                }}
                className="h-3.5 w-3.5"
              />
              <span>대신 <b>DB 등록일을 비우기</b> (날짜 제거)</span>
            </label>

            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive">
              이 작업은 <b>되돌릴 수 없습니다</b>. 변경 이력에 {selectedCount}건의 기록이 남습니다.
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t bg-sidebar/40 px-5 py-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              취소
            </Button>
            <Button
              type="button"
              className="bg-brand text-brand-foreground hover:bg-brand-hover"
              onClick={submit}
              disabled={pending || (!clearMode && !date)}
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CalendarClock className="h-4 w-4" />
              )}
              {selectedCount}건 변경
            </Button>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

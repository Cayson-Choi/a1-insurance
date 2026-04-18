"use client";

import { useState, useTransition } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { toast } from "sonner";
import { Copy, Eye, EyeOff, Loader2, ShieldAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { revealRrnAction } from "@/lib/customers/actions";

export function RrnRevealButton({
  customerId,
  hasRrn,
  customerName,
}: {
  customerId: string;
  hasRrn: boolean;
  customerName: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [revealed, setRevealed] = useState<{ front: string; back: string } | null>(null);

  function onReveal() {
    startTransition(async () => {
      const res = await revealRrnAction(customerId, reason.trim() || undefined);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setRevealed({ front: res.front, back: res.back });
      toast.info("변경 이력에 기록되었습니다.", { duration: 4000 });
    });
  }

  function copy() {
    if (!revealed) return;
    const text = `${revealed.front}-${revealed.back}`;
    navigator.clipboard?.writeText(text);
    toast.success("클립보드에 복사되었습니다.");
  }

  function closeAll() {
    setOpen(false);
    // 타이밍: 모달 닫힘 애니메이션 후 값 폐기
    setTimeout(() => {
      setRevealed(null);
      setReason("");
    }, 200);
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => (o ? setOpen(true) : closeAll())}>
      <DialogPrimitive.Trigger
        render={
          <button
            type="button"
            disabled={!hasRrn}
            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border px-2 py-1 text-[11px] font-medium text-foreground hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
            title={hasRrn ? "관리자 복호화 열람" : "주민번호가 등록되지 않았습니다"}
          >
            <Eye className="h-3 w-3" />
            복호화
          </button>
        }
      />
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm data-open:animate-in data-open:fade-in-0" />
        <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-[60] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-popover text-popover-foreground shadow-2xl ring-1 ring-foreground/10 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95">
          <div className="flex items-center gap-2 border-b px-5 py-3">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            <DialogPrimitive.Title className="text-base font-semibold">
              주민번호 복호화 — {customerName}
            </DialogPrimitive.Title>
          </div>

          {!revealed ? (
            <div className="space-y-3 px-5 py-4 text-sm">
              <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900">
                이 작업은 <b>변경 이력에 영구 기록</b>됩니다. 정당한 업무 목적이 있을 때만 열람하세요.
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  열람 사유 (선택)
                </Label>
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="예: 계약 서류 확인"
                  maxLength={100}
                  className="h-10"
                  autoFocus
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3 px-5 py-4">
              <div className="rounded-md border bg-muted/40 px-4 py-3 text-center">
                <div className="text-[11px] text-muted-foreground mb-1">주민번호</div>
                <div className="font-mono text-xl tabular-nums tracking-wider font-semibold select-all">
                  {revealed.front}-{revealed.back}
                </div>
              </div>
              <div className="text-[11px] text-muted-foreground">
                이 창을 닫는 즉시 브라우저 메모리에서 제거됩니다. 스크린샷·복사 후 반드시 삭제해주세요.
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t bg-sidebar/40 px-5 py-3">
            {!revealed ? (
              <>
                <Button type="button" variant="ghost" onClick={closeAll} disabled={pending}>
                  취소
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={onReveal}
                  disabled={pending}
                >
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                  열람 (기록됨)
                </Button>
              </>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={copy}>
                  <Copy className="h-4 w-4" />
                  복사
                </Button>
                <Button type="button" onClick={closeAll}>
                  <EyeOff className="h-4 w-4" />
                  닫기
                </Button>
              </>
            )}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

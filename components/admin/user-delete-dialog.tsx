"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { toast } from "sonner";
import { Loader2, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteUserAction } from "@/lib/users/actions";

export function UserDeleteDialog({
  agentId,
  name,
  customerCount,
  children,
}: {
  agentId: string;
  name: string;
  customerCount: number;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onDelete() {
    startTransition(async () => {
      const res = await deleteUserAction(agentId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${name}(${agentId}) 계정이 삭제되었습니다.`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger nativeButton={false} render={<div>{children}</div>} />
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-open:animate-in data-open:fade-in-0" />
        <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-popover text-popover-foreground shadow-2xl ring-1 ring-foreground/10 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95">
          <div className="flex items-center gap-2 border-b px-5 py-3">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <DialogPrimitive.Title className="text-base font-semibold">
              사용자 삭제
            </DialogPrimitive.Title>
          </div>
          <div className="space-y-3 px-5 py-4 text-sm">
            <div className="rounded-md bg-muted/50 px-3 py-2">
              대상: <b>{name}</b> · <span className="font-mono">{agentId}</span>
            </div>
            {customerCount > 0 ? (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900">
                ⚠ 이 담당자에게 배정된 고객이 <b>{customerCount}건</b> 있습니다. 삭제 시 해당 고객은 "미배정" 상태로 전환되며, 이후 관리자가 재배정해야 합니다.
              </div>
            ) : null}
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive">
              이 작업은 <b>되돌릴 수 없습니다</b>. 계정 삭제 후 같은 담당자ID로 새로 추가하더라도, 삭제 전 로그인 이력은 복원되지 않습니다.
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t bg-sidebar/40 px-5 py-3">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              취소
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={onDelete}
              disabled={pending}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              삭제
            </Button>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

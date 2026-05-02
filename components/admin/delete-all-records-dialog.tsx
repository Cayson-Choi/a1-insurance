"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type DeleteAllResult =
  | { ok: true; deleted: number }
  | { ok: false; error: string };

type Props = {
  title: string;
  triggerLabel: string;
  targetLabel: string;
  description: string;
  successMessage: (deleted: number) => string;
  action: () => Promise<DeleteAllResult>;
  className?: string;
};

export function DeleteAllRecordsDialog({
  title,
  triggerLabel,
  targetLabel,
  description,
  successMessage,
  action,
  className,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const res = await action();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(successMessage(res.deleted), { duration: 5000 });
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        render={
          <Button type="button" variant="destructive" className={className} />
        }
      >
        <Trash2 className="h-4 w-4" />
        {triggerLabel}
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-open:animate-in data-open:fade-in-0" />
        <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-popover text-popover-foreground shadow-2xl ring-1 ring-foreground/10 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95">
          <div className="flex items-center gap-2 border-b px-5 py-3">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <DialogPrimitive.Title className="text-base font-semibold">
              {title}
            </DialogPrimitive.Title>
          </div>
          <div className="space-y-3 px-5 py-4 text-sm">
            <div className="rounded-md bg-muted/50 px-3 py-2">
              대상: <b>{targetLabel}</b>
            </div>
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive">
              이 작업은 <b>되돌릴 수 없습니다</b>. {description}
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t bg-sidebar/40 px-5 py-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              취소
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={submit}
              disabled={pending}
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              전체 삭제
            </Button>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

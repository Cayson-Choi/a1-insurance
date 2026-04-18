"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteCustomerAction } from "@/lib/customers/actions";

export function DeleteCustomerDialog({
  customerId,
  customerName,
  onDeleted,
  children,
}: {
  customerId: string;
  customerName: string;
  onDeleted?: () => void;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onDelete() {
    startTransition(async () => {
      const res = await deleteCustomerAction(customerId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${customerName} 고객이 삭제되었습니다.`);
      setOpen(false);
      if (onDeleted) onDeleted();
      else router.push("/customers");
    });
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger nativeButton={false} render={<div>{children}</div>} />
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm data-open:animate-in data-open:fade-in-0" />
        <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-[60] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-popover text-popover-foreground shadow-2xl ring-1 ring-foreground/10 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95">
          <div className="flex items-center gap-2 border-b px-5 py-3">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <DialogPrimitive.Title className="text-base font-semibold">
              고객 삭제
            </DialogPrimitive.Title>
          </div>
          <div className="space-y-3 px-5 py-4 text-sm">
            <div className="rounded-md bg-muted/50 px-3 py-2">
              대상: <b>{customerName}</b>
            </div>
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive">
              이 작업은 <b>되돌릴 수 없습니다</b>. 고객 정보·주민번호 암호문·주소·메모 등 모든 레코드가 영구 삭제됩니다.
              변경 이력에는 삭제 기록이 남습니다.
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t bg-sidebar/40 px-5 py-3">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              취소
            </Button>
            <Button type="button" variant="destructive" onClick={onDelete} disabled={pending}>
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              삭제
            </Button>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

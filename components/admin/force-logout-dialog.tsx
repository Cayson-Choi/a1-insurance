"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { toast } from "sonner";
import { Loader2, LogOut, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { forceLogoutAction } from "@/lib/users/actions";

export function ForceLogoutDialog({
  agentId,
  name,
  children,
}: {
  agentId: string;
  name: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onConfirm() {
    startTransition(async () => {
      const res = await forceLogoutAction(agentId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${name}(${agentId}) 계정을 강제 로그아웃했습니다.`);
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
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <DialogPrimitive.Title className="text-base font-semibold">
              강제 로그아웃
            </DialogPrimitive.Title>
          </div>
          <div className="space-y-3 px-5 py-4 text-sm">
            <div className="rounded-md bg-muted/50 px-3 py-2">
              대상: <b>{name}</b> · <span className="font-mono">{agentId}</span>
            </div>
            <div className="text-muted-foreground">
              해당 사용자의 기존 세션이 무효화되어 <b>다음 페이지 이동 시 로그인 화면으로 돌아갑니다</b>.
              사용자 권한이나 데이터는 변경되지 않으며, 언제든 다시 로그인할 수 있습니다.
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t bg-sidebar/40 px-5 py-3">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              취소
            </Button>
            <Button
              type="button"
              onClick={onConfirm}
              disabled={pending}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              강제 로그아웃
            </Button>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

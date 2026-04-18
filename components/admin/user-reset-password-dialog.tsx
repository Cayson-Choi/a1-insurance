"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { resetPasswordAction } from "@/lib/users/actions";

export function UserResetPasswordDialog({
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
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await resetPasswordAction(agentId, fd);
      if (!res.ok) {
        setError(res.fieldErrors?.password?.[0] ?? res.error);
        toast.error(res.error);
        return;
      }
      toast.success(`${name}(${agentId})의 비밀번호가 재설정되었습니다.`);
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
          <form onSubmit={onSubmit}>
            <div className="flex items-center gap-2 border-b px-5 py-3">
              <KeyRound className="h-5 w-5 text-brand" />
              <DialogPrimitive.Title className="text-base font-semibold">
                비밀번호 재설정
              </DialogPrimitive.Title>
            </div>
            <div className="space-y-3 px-5 py-4">
              <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                대상: <b>{name}</b> · <span className="font-mono">{agentId}</span>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  새 비밀번호
                  <span className="ml-1 text-destructive">*</span>
                </Label>
                <Input
                  type="password"
                  name="password"
                  required
                  minLength={6}
                  placeholder="6자 이상"
                  className="h-10"
                  autoComplete="new-password"
                  autoFocus
                />
                {error ? <div className="text-xs text-destructive">{error}</div> : null}
              </div>
              <div className="text-[11px] text-muted-foreground">
                재설정 후 해당 사용자는 새 비밀번호로 로그인해야 합니다.
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t bg-sidebar/40 px-5 py-3">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                취소
              </Button>
              <Button
                type="submit"
                className="bg-brand text-brand-foreground hover:bg-brand-hover"
                disabled={pending}
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                재설정
              </Button>
            </div>
          </form>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

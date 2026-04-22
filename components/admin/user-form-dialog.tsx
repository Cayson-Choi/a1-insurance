"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { toast } from "sonner";
import { Loader2, UserPlus, UserPen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { createUserAction, updateUserAction } from "@/lib/users/actions";
import type { UserRow } from "@/lib/users/queries";

type Mode = "create" | "edit";

export function UserFormDialog({
  mode,
  user,
  children,
}: {
  mode: Mode;
  user?: UserRow;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [role, setRole] = useState<"admin" | "agent">(user?.role ?? "agent");
  const [canCreate, setCanCreate] = useState(user?.canCreate ?? false);
  const [canEdit, setCanEdit] = useState(user?.canEdit ?? false);
  const [canDelete, setCanDelete] = useState(user?.canDelete ?? false);
  const [canExport, setCanExport] = useState(user?.canExport ?? false);
  const [canDownloadImage, setCanDownloadImage] = useState(
    user?.canDownloadImage ?? false,
  );
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("role", role);
    fd.set("canCreate", String(canCreate));
    fd.set("canEdit", String(canEdit));
    fd.set("canDelete", String(canDelete));
    fd.set("canExport", String(canExport));
    fd.set("canDownloadImage", String(canDownloadImage));
    setErrors({});
    startTransition(async () => {
      const res =
        mode === "create"
          ? await createUserAction(fd)
          : await updateUserAction(user!.agentId, fd);
      if (!res.ok) {
        toast.error(res.error);
        if (res.fieldErrors) setErrors(res.fieldErrors);
        return;
      }
      toast.success(
        mode === "create" ? "사용자가 추가되었습니다." : "사용자 정보가 수정되었습니다.",
      );
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
          <form onSubmit={onSubmit} className="flex flex-col">
            <div className="flex items-center gap-2 border-b px-5 py-3">
              {mode === "create" ? (
                <UserPlus className="h-5 w-5 text-brand" />
              ) : (
                <UserPen className="h-5 w-5 text-brand" />
              )}
              <DialogPrimitive.Title className="text-base font-semibold">
                {mode === "create" ? "사용자 추가" : `사용자 수정 — ${user?.name ?? user?.agentId}`}
              </DialogPrimitive.Title>
            </div>

            <div className="space-y-3.5 px-5 py-4">
              <Field label="담당자ID" required error={errors.agentId?.[0]}>
                <Input
                  name="agentId"
                  defaultValue={user?.agentId ?? ""}
                  disabled={mode === "edit"}
                  className="h-10 font-mono"
                  placeholder="예: a00015"
                  required
                  autoComplete="off"
                />
              </Field>

              <Field label="이름" required error={errors.name?.[0]}>
                <Input
                  name="name"
                  defaultValue={user?.name ?? ""}
                  className="h-10"
                  placeholder="홍길동"
                  required
                />
              </Field>

              <Field label="역할" required>
                <Select value={role} onValueChange={(v) => v && setRole(v as typeof role)}>
                  <SelectTrigger className="h-10 w-full">
                    <span>{role === "admin" ? "관리자" : "담당자"}</span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agent">담당자</SelectItem>
                    <SelectItem value="admin">관리자</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-muted-foreground">
                    담당자 권한
                  </Label>
                  {role === "admin" ? (
                    <span className="text-[11px] text-brand-accent">관리자는 모든 권한 자동 부여</span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">체크 안 된 항목은 제한됨</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <PermCheck
                    label="입력 (신규 등록)"
                    disabled={role === "admin"}
                    checked={role === "admin" || canCreate}
                    onChange={setCanCreate}
                  />
                  <PermCheck
                    label="수정"
                    disabled={role === "admin"}
                    checked={role === "admin" || canEdit}
                    onChange={setCanEdit}
                  />
                  <PermCheck
                    label="삭제"
                    disabled={role === "admin"}
                    checked={role === "admin" || canDelete}
                    onChange={setCanDelete}
                  />
                  <PermCheck
                    label="엑셀 다운로드"
                    disabled={role === "admin"}
                    checked={role === "admin" || canExport}
                    onChange={setCanExport}
                  />
                  <PermCheck
                    label="이미지 다운로드"
                    disabled={role === "admin"}
                    checked={role === "admin" || canDownloadImage}
                    onChange={setCanDownloadImage}
                  />
                </div>
              </div>

              {mode === "create" ? (
                <Field label="초기 비밀번호" required error={errors.password?.[0]}>
                  <Input
                    type="password"
                    name="password"
                    className="h-10"
                    placeholder="6자 이상"
                    required
                    autoComplete="new-password"
                  />
                </Field>
              ) : null}
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
                type="submit"
                className="bg-brand text-brand-foreground hover:bg-brand-hover"
                disabled={pending}
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {mode === "create" ? "추가" : "저장"}
              </Button>
            </div>
          </form>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function Field({
  label,
  children,
  required,
  error,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        {label}
        {required ? <span className="ml-1 text-destructive">*</span> : null}
      </Label>
      {children}
      {error ? <div className="text-xs text-destructive">{error}</div> : null}
    </div>
  );
}

function PermCheck({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer">
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={(v) => onChange(v === true)}
      />
      <span>{label}</span>
    </label>
  );
}

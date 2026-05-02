"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Inbox,
  Loader2,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import { simplifyUserAgent } from "@/lib/notifications/format";
import { deleteLoginEventsAction } from "@/lib/logins/actions";
import type { LoginEventRow } from "@/lib/logins/queries";

export function LoginHistoryTable({ rows }: { rows: LoginEventRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const selectedIds = useMemo(() => Array.from(selected), [selected]);
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const someSelected = !allSelected && rows.some((r) => selected.has(r.id));

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const row of rows) {
        if (checked) next.add(row.id);
        else next.delete(row.id);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function deleteSelected() {
    startTransition(async () => {
      const res = await deleteLoginEventsAction(selectedIds);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${res.deleted}건의 로그인 이력을 삭제했습니다.`);
      setConfirmOpen(false);
      clearSelection();
      router.refresh();
    });
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-card/50 py-16 text-center">
        <Inbox className="mx-auto h-10 w-10 text-muted-foreground/60" />
        <div className="mt-3 text-sm font-medium text-foreground">
          조건에 맞는 로그인 이력이 없습니다.
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
        <Table className="min-w-[940px]">
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onCheckedChange={(v) => toggleAll(v === true)}
                  aria-label="현재 페이지 로그인 이력 전체 선택"
                />
              </TableHead>
              <TableHead className="w-44">시각</TableHead>
              <TableHead className="w-20">결과</TableHead>
              <TableHead className="w-32">담당자ID</TableHead>
              <TableHead className="w-28">이름</TableHead>
              <TableHead className="w-36">IP</TableHead>
              <TableHead className="w-40">브라우저 / OS</TableHead>
              <TableHead>사유</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const isSelected = selected.has(row.id);
              return (
                <TableRow
                  key={row.id}
                  className={cn(
                    "hover:bg-brand-muted/30",
                    !row.success && "bg-red-50/50 hover:bg-red-50",
                    isSelected && "bg-brand/30 hover:bg-brand/40",
                  )}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(v) => toggleOne(row.id, v === true)}
                      aria-label="로그인 이력 선택"
                    />
                  </TableCell>
                  <TableCell className="text-xs tabular-nums text-muted-foreground">
                    {formatDateTime(row.createdAt)}
                  </TableCell>
                  <TableCell>
                    {row.success ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        성공
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
                        <XCircle className="h-3.5 w-3.5" />
                        실패
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {row.agentId ?? <span className="text-muted-foreground">(미입력)</span>}
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.agentName ?? <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {row.ip ?? "-"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {simplifyUserAgent(row.userAgent)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {row.reason ?? (row.success ? "-" : "")}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {selected.size > 0 ? (
        <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full border bg-background/95 backdrop-blur shadow-xl ring-1 ring-foreground/10 px-4 py-2 flex items-center gap-3">
          <span className="text-sm font-medium">
            <b className="text-brand-accent tabular-nums">{selected.size}</b>건 선택됨
          </span>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
            선택 삭제
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={clearSelection}
          >
            <X className="h-4 w-4" />
            선택 해제
          </Button>
        </div>
      ) : null}

      <DialogPrimitive.Root open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-open:animate-in data-open:fade-in-0" />
          <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-popover text-popover-foreground shadow-2xl ring-1 ring-foreground/10 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95">
            <div className="flex items-center gap-2 border-b px-5 py-3">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <DialogPrimitive.Title className="text-base font-semibold">
                로그인 이력 삭제
              </DialogPrimitive.Title>
            </div>
            <div className="space-y-3 px-5 py-4 text-sm">
              <div className="rounded-md bg-muted/50 px-3 py-2">
                선택된 이력: <b>{selected.size}</b>건
              </div>
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive">
                이 작업은 <b>되돌릴 수 없습니다</b>. 로그인 성공/실패 이력이 영구 삭제됩니다.
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t bg-sidebar/40 px-5 py-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setConfirmOpen(false)}
                disabled={pending}
              >
                취소
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={deleteSelected}
                disabled={pending || selected.size === 0}
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                {selected.size}건 삭제
              </Button>
            </div>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}

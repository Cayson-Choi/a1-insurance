"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  Eye,
  FileSpreadsheet,
  Inbox,
  KeyRound,
  Loader2,
  LogOut,
  PencilLine,
  ShieldAlert,
  Trash2,
  UserCog,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDateTime } from "@/lib/format";
import { diffFields } from "@/lib/audit/diff";
import { deleteAuditLogsAction } from "@/lib/audit/actions";
import type { AuditRow } from "@/lib/audit/queries";

const ACTION_META: Record<
  AuditRow["action"],
  { label: string; className: string; icon: typeof Eye }
> = {
  edit: {
    label: "편집",
    className: "bg-blue-50 text-blue-700 border-blue-200",
    icon: PencilLine,
  },
  agent_change: {
    label: "담당자 변경",
    className: "bg-brand-muted text-[#155e75] border-brand/30",
    icon: UserCog,
  },
  bulk_change: {
    label: "일괄 변경",
    className: "bg-purple-50 text-purple-700 border-purple-200",
    icon: Users,
  },
  rrn_decrypt: {
    label: "주민번호 조회",
    className: "bg-rose-50 text-rose-700 border-rose-200",
    icon: Eye,
  },
  user_create: {
    label: "사용자 생성",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: UserPlus,
  },
  user_update: {
    label: "사용자 수정",
    className: "bg-sky-50 text-sky-700 border-sky-200",
    icon: UserCog,
  },
  user_delete: {
    label: "사용자 삭제",
    className: "bg-rose-50 text-rose-700 border-rose-200",
    icon: UserMinus,
  },
  password_reset: {
    label: "비밀번호 리셋",
    className: "bg-amber-50 text-amber-700 border-amber-200",
    icon: KeyRound,
  },
  force_logout: {
    label: "강제 로그아웃",
    className: "bg-orange-50 text-orange-700 border-orange-200",
    icon: LogOut,
  },
  import: {
    label: "엑셀 일괄등록",
    className: "bg-indigo-50 text-indigo-700 border-indigo-200",
    icon: FileSpreadsheet,
  },
};

const UNKNOWN_META = {
  label: "기타",
  className: "bg-slate-50 text-slate-700 border-slate-200",
  icon: ShieldAlert,
};

function Summary({ row }: { row: AuditRow }) {
  if (row.action === "rrn_decrypt") {
    return <span className="text-muted-foreground">주민번호 보호값 조회</span>;
  }
  if (row.action === "agent_change" || row.action === "bulk_change") {
    const before = (row.before as { agentId?: string } | null)?.agentId ?? "미배정";
    const after = (row.after as { agentId?: string } | null)?.agentId ?? "미배정";
    return (
      <span className="font-mono text-xs">
        {before} <ArrowRight className="inline h-3 w-3" /> {after}
      </span>
    );
  }
  if (row.action === "import") {
    const after = row.after as
      | { total?: number; updated?: number; inserted?: number }
      | null;
    return (
      <span className="text-xs">
        총 <b>{after?.total ?? 0}</b>건 · 신규 {after?.inserted ?? 0} · 갱신{" "}
        {after?.updated ?? 0}
      </span>
    );
  }
  if (row.action === "user_create" || row.action === "user_delete") {
    const target = (row.after ?? row.before) as
      | { agentId?: string; name?: string; role?: string }
      | null;
    return (
      <span className="text-xs">
        {target?.name ?? "-"} · {target?.agentId ?? "-"}
        {target?.role ? ` (${target.role})` : ""}
      </span>
    );
  }
  if (row.action === "password_reset" || row.action === "force_logout") {
    const target = row.after as { agentId?: string; name?: string } | null;
    return (
      <span className="text-xs">
        대상 {target?.name ?? "-"} · {target?.agentId ?? "-"}
      </span>
    );
  }
  const changes = diffFields(row.before, row.after);
  if (!changes.length) {
    return <span className="text-muted-foreground">변경 내용 없음</span>;
  }
  const first = changes[0];
  const more = changes.length - 1;
  return (
    <span className="text-xs">
      <b>{first.label}</b>
      <span className="text-muted-foreground"> : </span>
      <span className="text-muted-foreground line-through">{first.before}</span>
      <span> → </span>
      <span>{first.after}</span>
      {more > 0 ? <span className="text-muted-foreground"> 외 {more}건</span> : null}
    </span>
  );
}

export function AuditTable({ rows }: { rows: AuditRow[] }) {
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
      const res = await deleteAuditLogsAction(selectedIds);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${res.deleted}건의 변경 이력을 삭제했습니다.`);
      setConfirmOpen(false);
      clearSelection();
      router.refresh();
    });
  }

  if (!rows.length) {
    return (
      <div className="rounded-lg border border-dashed bg-card/50 py-16 text-center">
        <Inbox className="mx-auto h-10 w-10 text-muted-foreground/60" />
        <div className="mt-3 text-sm font-medium text-foreground">
          조건에 맞는 이력이 없습니다.
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
        <Table className="min-w-[840px]">
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onCheckedChange={(v) => toggleAll(v === true)}
                  aria-label="현재 페이지 변경 이력 전체 선택"
                />
              </TableHead>
              <TableHead className="w-44">일시</TableHead>
              <TableHead className="w-32">작업자</TableHead>
              <TableHead className="w-32">액션</TableHead>
              <TableHead className="w-40">대상 고객</TableHead>
              <TableHead>내용 요약</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const meta = ACTION_META[row.action] ?? UNKNOWN_META;
              const Icon = meta.icon;
              const isSelected = selected.has(row.id);
              return (
                <TableRow key={row.id} className={isSelected ? "bg-brand/30" : undefined}>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(v) => toggleOne(row.id, v === true)}
                      aria-label="변경 이력 선택"
                    />
                  </TableCell>
                  <TableCell className="tabular-nums text-xs">
                    {formatDateTime(row.createdAt)}
                  </TableCell>
                  <TableCell className="text-sm">
                    <span className="font-medium">{row.actorName ?? "-"}</span>
                    <span className="ml-1 text-muted-foreground font-mono text-[11px]">
                      {row.actorAgentId}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`gap-1 text-xs ${meta.className}`}>
                      <Icon className="h-3 w-3" />
                      {meta.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {row.customerId ? (
                      <Link
                        href={`/customers/${row.customerId}`}
                        className="text-sm text-brand-accent hover:underline"
                      >
                        {row.customerName ?? row.customerId.slice(0, 8)}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm max-w-xl">
                    <Summary row={row} />
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
                변경 이력 삭제
              </DialogPrimitive.Title>
            </div>
            <div className="space-y-3 px-5 py-4 text-sm">
              <div className="rounded-md bg-muted/50 px-3 py-2">
                선택된 이력: <b>{selected.size}</b>건
              </div>
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive">
                이 작업은 <b>되돌릴 수 없습니다</b>. 감사 목적의 변경 이력이 영구 삭제됩니다.
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

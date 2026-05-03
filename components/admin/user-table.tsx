"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Edit3, KeyRound, LogOut, Shield, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserFormDialog } from "@/components/admin/user-form-dialog";
import { UserResetPasswordDialog } from "@/components/admin/user-reset-password-dialog";
import { UserDeleteDialog } from "@/components/admin/user-delete-dialog";
import { ForceLogoutDialog } from "@/components/admin/force-logout-dialog";
import { formatDateTime } from "@/lib/format";
import { isOnline } from "@/lib/users/online";
import type { UserRow } from "@/lib/users/queries";

export function UserTable({
  rows,
  currentAgentId,
}: {
  rows: UserRow[];
  currentAgentId: string;
}) {
  const router = useRouter();

  useEffect(() => {
    const id = window.setInterval(() => {
      router.refresh();
    }, 30_000);
    return () => window.clearInterval(id);
  }, [router]);

  return (
    <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
      <Table className="min-w-[960px]">
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="w-20">상태</TableHead>
            <TableHead className="w-28">담당자ID</TableHead>
            <TableHead className="w-24">이름</TableHead>
            <TableHead className="w-20">역할</TableHead>
            <TableHead>권한</TableHead>
            <TableHead className="w-20 text-right">담당 고객</TableHead>
            <TableHead className="w-40">최근 활동</TableHead>
            <TableHead className="w-[280px] text-right">동작</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((u) => {
            const isSelf = u.agentId === currentAgentId;
            const online = isOnline(u.lastSeenAt, u.sessionsInvalidatedAt);
            return (
              <TableRow key={u.id}>
                <TableCell>
                  {online ? (
                    <span
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700"
                      title={`마지막 활동: ${formatDateTime(u.lastSeenAt)}`}
                    >
                      <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                      접속 중
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                      오프라인
                    </span>
                  )}
                </TableCell>
                <TableCell className="font-mono text-sm">{u.agentId}</TableCell>
                <TableCell className="font-medium">
                  {u.name}
                  {isSelf ? (
                    <span className="ml-1.5 text-[10px] text-brand-accent">(나)</span>
                  ) : null}
                </TableCell>
                <TableCell>
                  {u.role === "admin" ? (
                    <Badge className="bg-brand text-brand-foreground hover:bg-brand gap-1">
                      <Shield className="h-3 w-3" />
                      관리자
                    </Badge>
                  ) : u.role === "manager" ? (
                    <Badge className="bg-brand-accent text-white hover:bg-brand-accent gap-1">
                      <ShieldCheck className="h-3 w-3" />
                      매니저
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1">
                      <UserRound className="h-3 w-3" />
                      담당자
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {u.role === "admin" ? (
                    <span className="text-xs text-muted-foreground">전체 권한</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {/* 매니저 기본 권한: 전체 조회 + 담당자 변경 — 뱃지로 항상 on 표시 */}
                      {u.role === "manager" ? (
                        <>
                          <PermBadge label="전체조회" on={true} />
                          <PermBadge label="담당자변경" on={true} />
                        </>
                      ) : null}
                      <PermBadge label="입력" on={u.canCreate} />
                      <PermBadge label="수정" on={u.canEdit} />
                      <PermBadge label="삭제" on={u.canDelete} />
                      <PermBadge label="엑셀" on={u.canExport} />
                      <PermBadge label="이미지" on={u.canDownloadImage} />
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {u.customerCount.toLocaleString("ko-KR")}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground tabular-nums">
                  {formatDateTime(u.lastSeenAt) || formatDateTime(u.lastLoginAt) || "없음"}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1.5">
                    <UserFormDialog mode="edit" user={u}>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium hover:bg-accent"
                        title="수정"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        수정
                      </button>
                    </UserFormDialog>
                    <UserResetPasswordDialog agentId={u.agentId} name={u.name}>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium hover:bg-accent"
                        title="비밀번호 재설정"
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                        비밀번호
                      </button>
                    </UserResetPasswordDialog>
                    {isSelf ? (
                      <button
                        type="button"
                        disabled
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground opacity-50 cursor-not-allowed"
                        title="본인 계정은 강제 로그아웃할 수 없습니다"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        로그아웃
                      </button>
                    ) : (
                      <ForceLogoutDialog agentId={u.agentId} name={u.name}>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50"
                          title="강제 로그아웃"
                        >
                          <LogOut className="h-3.5 w-3.5" />
                          로그아웃
                        </button>
                      </ForceLogoutDialog>
                    )}
                    {isSelf ? (
                      <button
                        type="button"
                        disabled
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground opacity-50 cursor-not-allowed"
                        title="본인 계정은 삭제할 수 없습니다"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        삭제
                      </button>
                    ) : (
                      <UserDeleteDialog
                        agentId={u.agentId}
                        name={u.name}
                        customerCount={u.customerCount}
                      >
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10"
                          title="삭제"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          삭제
                        </button>
                      </UserDeleteDialog>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function PermBadge({ label, on }: { label: string; on: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap",
        on
          ? "bg-brand/15 text-[#155e75] border-brand/30"
          : "bg-muted text-muted-foreground/60 border-border line-through",
      )}
    >
      {label}
    </span>
  );
}

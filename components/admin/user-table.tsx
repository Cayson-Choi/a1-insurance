"use client";

import { Edit3, KeyRound, Shield, Trash2, UserRound } from "lucide-react";
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
import { formatDateTime } from "@/lib/format";
import type { UserRow } from "@/lib/users/queries";

export function UserTable({
  rows,
  currentAgentId,
}: {
  rows: UserRow[];
  currentAgentId: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="w-28">담당자ID</TableHead>
            <TableHead className="w-24">이름</TableHead>
            <TableHead className="w-20">역할</TableHead>
            <TableHead>권한</TableHead>
            <TableHead className="w-20 text-right">담당 고객</TableHead>
            <TableHead className="w-40">최근 로그인</TableHead>
            <TableHead className="w-[210px] text-right">동작</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((u) => {
            const isSelf = u.agentId === currentAgentId;
            return (
              <TableRow key={u.id}>
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
                      <PermBadge label="데이터 관리" on={u.canManage} />
                      <PermBadge label="엑셀 다운로드" on={u.canExport} />
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {u.customerCount.toLocaleString("ko-KR")}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground tabular-nums">
                  {formatDateTime(u.lastLoginAt) || "없음"}
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
          ? "bg-brand/15 text-[#b4610e] border-brand/30"
          : "bg-muted text-muted-foreground/60 border-border line-through",
      )}
    >
      {label}
    </span>
  );
}

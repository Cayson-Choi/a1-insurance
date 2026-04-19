"use client";

import { Inbox, CheckCircle2, XCircle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import { simplifyUserAgent } from "@/lib/notifications/slack";
import type { LoginEventRow } from "@/lib/logins/queries";

export function LoginHistoryTable({ rows }: { rows: LoginEventRow[] }) {
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
    <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
      <Table className="min-w-[900px]">
        <TableHeader className="bg-muted/50">
          <TableRow>
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
          {rows.map((r) => (
            <TableRow
              key={r.id}
              className={cn(
                "hover:bg-brand-muted/30",
                !r.success && "bg-red-50/50 hover:bg-red-50",
              )}
            >
              <TableCell className="text-xs tabular-nums text-muted-foreground">
                {formatDateTime(r.createdAt)}
              </TableCell>
              <TableCell>
                {r.success ? (
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
                {r.agentId ?? <span className="text-muted-foreground">(미입력)</span>}
              </TableCell>
              <TableCell className="text-sm">
                {r.agentName ?? <span className="text-muted-foreground">-</span>}
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {r.ip ?? "-"}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {simplifyUserAgent(r.userAgent)}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {r.reason ?? (r.success ? "-" : "")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

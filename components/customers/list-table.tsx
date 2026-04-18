"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Inbox, UserCog, X } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { CallResultBadge } from "@/components/customers/call-result-badge";
import { BulkReassignDialog } from "@/components/customers/bulk-reassign-dialog";
import { formatDate, formatPhone, maskPhone, shortAddress } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ListedCustomer } from "@/lib/customers/queries";

export function ListTable({
  rows,
  showAgentColumn,
  preservedQuery,
  canUnmaskPhone,
  canBulkEdit,
  agents,
}: {
  rows: ListedCustomer[];
  showAgentColumn: boolean;
  preservedQuery: string;
  canUnmaskPhone: boolean;
  canBulkEdit: boolean;
  agents: Array<{ agentId: string; name: string }>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);

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
      for (const r of rows) {
        if (checked) next.add(r.id);
        else next.delete(r.id);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  const selectedIds = useMemo(() => Array.from(selected), [selected]);

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-card/50 py-16 text-center">
        <Inbox className="mx-auto h-10 w-10 text-muted-foreground/60" />
        <div className="mt-3 text-sm font-medium text-foreground">조건에 맞는 고객이 없습니다.</div>
        <div className="mt-1 text-xs text-muted-foreground">
          검색어를 확인하거나 필터를 초기화해보세요.
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
        <Table className="min-w-[900px]">
          <TableHeader className="bg-muted/50">
            <TableRow>
              {canBulkEdit ? (
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onCheckedChange={(v) => toggleAll(v === true)}
                    aria-label="현재 페이지 전체 선택"
                  />
                </TableHead>
              ) : null}
              {showAgentColumn ? <TableHead className="w-28">담당자</TableHead> : null}
              <TableHead className="w-28">이름</TableHead>
              <TableHead className="w-36">연락처</TableHead>
              <TableHead className="w-28">생년월일</TableHead>
              <TableHead>주소</TableHead>
              <TableHead className="w-44">직업</TableHead>
              <TableHead className="w-24">통화결과</TableHead>
              <TableHead className="w-28">보험사</TableHead>
              <TableHead className="w-28">DB 등록일</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => {
              const href = `/customers/${c.id}${preservedQuery ? `?${preservedQuery}` : ""}`;
              const isSelected = selected.has(c.id);
              return (
                <TableRow
                  key={c.id}
                  className={cn(
                    "hover:bg-brand-muted/40",
                    isSelected && "bg-brand-muted/60",
                  )}
                >
                  {canBulkEdit ? (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(v) => toggleOne(c.id, v === true)}
                        aria-label={`${c.name} 선택`}
                      />
                    </TableCell>
                  ) : null}
                  {showAgentColumn ? (
                    <TableCell className="text-sm">
                      <Link href={href} className="block">
                        {c.agentName ?? (
                          <span className="text-muted-foreground">미배정</span>
                        )}
                      </Link>
                    </TableCell>
                  ) : null}
                  <TableCell className="font-medium">
                    <Link href={href} className="block">
                      {c.name}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-sm tabular-nums">
                    <Link href={href} className="block">
                      {canUnmaskPhone ? formatPhone(c.phone1) : maskPhone(c.phone1)}
                    </Link>
                  </TableCell>
                  <TableCell className="tabular-nums text-sm">
                    <Link href={href} className="block">
                      {formatDate(c.birthDate)}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">
                    <Link href={href} className="block" title={c.address ?? ""}>
                      {shortAddress(c.address, 28)}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">
                    <Link href={href} className="block truncate max-w-40" title={c.job ?? ""}>
                      {c.job}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={href} className="block">
                      <CallResultBadge value={c.callResult} />
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">
                    <Link href={href} className="block">
                      {c.dbCompany}
                    </Link>
                  </TableCell>
                  <TableCell className="tabular-nums text-sm">
                    <Link href={href} className="block">
                      {formatDate(c.dbRegisteredAt)}
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {canBulkEdit && selected.size > 0 ? (
        <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full border bg-background/95 backdrop-blur shadow-xl ring-1 ring-foreground/10 px-4 py-2 flex items-center gap-3">
          <span className="text-sm font-medium">
            <b className="text-brand-accent tabular-nums">{selected.size}</b>건 선택됨
          </span>
          <Button
            type="button"
            size="sm"
            className="bg-brand text-brand-foreground hover:bg-brand-hover"
            onClick={() => setBulkOpen(true)}
          >
            <UserCog className="h-4 w-4" />
            담당자 일괄 변경
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

      {canBulkEdit ? (
        <BulkReassignDialog
          open={bulkOpen}
          onOpenChange={setBulkOpen}
          selectedCount={selected.size}
          selectedIds={selectedIds}
          agents={agents}
          onDone={clearSelection}
        />
      ) : null}
    </>
  );
}

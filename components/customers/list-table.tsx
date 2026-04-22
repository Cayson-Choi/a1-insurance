"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  ChevronsUpDown,
  GripVertical,
  Inbox,
  RotateCcw,
  UserCog,
  X,
} from "lucide-react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { CallResultBadge } from "@/components/customers/call-result-badge";
import { BulkReassignDialog } from "@/components/customers/bulk-reassign-dialog";
import { BulkUpdateDateDialog } from "@/components/customers/bulk-update-date-dialog";
import { useTablePrefs } from "@/components/customers/use-table-prefs";
import { formatDate, formatDateTime, formatPhone, maskPhone } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  CUSTOMER_COLUMNS,
  type CustomerColumnDef,
  type CustomerColumnId,
  type SortDir,
  type SortKey,
} from "@/lib/customers/columns";
import type { ListedCustomer } from "@/lib/customers/queries";

type Props = {
  rows: ListedCustomer[];
  showAgentColumn: boolean;
  preservedQuery: string;
  canUnmaskPhone: boolean;
  canBulkEdit: boolean;
  agents: Array<{ agentId: string; name: string }>;
  sort: SortKey | null;
  dir: SortDir;
};

export function ListTable({
  rows,
  showAgentColumn,
  preservedQuery,
  canUnmaskPhone,
  canBulkEdit,
  agents,
  sort,
  dir,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { order, widths, setOrder, setMultiWidths, resetAll, hydrated } = useTablePrefs();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkDateOpen, setBulkDateOpen] = useState(false);

  // 보이는 컬럼만 추림 (admin 전용은 권한 없으면 제외)
  const visibleIds = useMemo(
    () =>
      order.filter((id) => {
        const def = CUSTOMER_COLUMNS.find((c) => c.id === id);
        return def && (!def.adminOnly || showAgentColumn);
      }),
    [order, showAgentColumn],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = visibleIds.indexOf(active.id as CustomerColumnId);
    const newIdx = visibleIds.indexOf(over.id as CustomerColumnId);
    if (oldIdx < 0 || newIdx < 0) return;
    const newVisible = arrayMove(visibleIds, oldIdx, newIdx);
    // 보이지 않는(adminOnly + 비admin) 컬럼은 기존 order 유지하면서 보이는 부분만 교체
    const merged: CustomerColumnId[] = [];
    let cursor = 0;
    for (const id of order) {
      const def = CUSTOMER_COLUMNS.find((c) => c.id === id);
      const visible = def && (!def.adminOnly || showAgentColumn);
      if (visible) {
        merged.push(newVisible[cursor]!);
        cursor += 1;
      } else {
        merged.push(id);
      }
    }
    setOrder(merged);
  }

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
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const someSelected = !allSelected && rows.some((r) => selected.has(r.id));

  function changeSort(columnId: CustomerColumnId) {
    const def = CUSTOMER_COLUMNS.find((c) => c.id === columnId);
    if (!def?.sortable) return;
    const next = new URLSearchParams(searchParams?.toString() ?? "");
    // 토글 순서: none → asc → desc → none
    if (sort !== columnId) {
      next.set("sort", columnId);
      next.set("dir", "asc");
    } else if (dir === "asc") {
      next.set("sort", columnId);
      next.set("dir", "desc");
    } else {
      next.delete("sort");
      next.delete("dir");
    }
    next.delete("page"); // 정렬 변경 시 첫 페이지로
    const qs = next.toString();
    router.push(`/customers${qs ? `?${qs}` : ""}`);
  }

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

  // 폭: localStorage 우선, 없으면 기본값
  function widthOf(id: CustomerColumnId): number {
    const def = CUSTOMER_COLUMNS.find((c) => c.id === id)!;
    return widths[id] ?? def.defaultWidth;
  }

  return (
    <>
      <div className="flex items-center justify-end gap-2 mb-2 text-xs text-muted-foreground">
        <span className="hidden md:inline">컬럼 헤더 드래그·우측 가장자리로 폭 조절·헤더 클릭으로 정렬</span>
        <button
          type="button"
          onClick={resetAll}
          disabled={!hydrated}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-accent transition disabled:opacity-50"
          title="컬럼 순서·폭 기본값 복원"
        >
          <RotateCcw className="h-3 w-3" />
          컬럼 초기화
        </button>
      </div>

      <div className="border bg-card shadow-sm overflow-x-auto">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <table className="w-full text-sm border-separate border-spacing-0 table-fixed" style={{ minWidth: 3600 }}>
            <colgroup>
              {canBulkEdit ? <col style={{ width: 40 }} /> : null}
              {visibleIds.map((id) => (
                <col key={id} style={{ width: widthOf(id) }} />
              ))}
            </colgroup>
            <thead className="bg-muted/50">
              <tr>
                {canBulkEdit ? (
                  <th className="h-10 px-3 text-left align-middle border-b border-r">
                    <Checkbox
                      checked={allSelected}
                      indeterminate={someSelected}
                      onCheckedChange={(v) => toggleAll(v === true)}
                      aria-label="현재 페이지 전체 선택"
                    />
                  </th>
                ) : null}
                <SortableContext items={visibleIds} strategy={horizontalListSortingStrategy}>
                  {visibleIds.map((id, i) => {
                    const def = CUSTOMER_COLUMNS.find((c) => c.id === id)!;
                    const prevId = i > 0 ? visibleIds[i - 1]! : null;
                    const prevDef = prevId ? CUSTOMER_COLUMNS.find((c) => c.id === prevId)! : null;
                    return (
                      <SortableHeader
                        key={id}
                        col={def}
                        sortDir={sort === id ? dir : null}
                        onSort={() => changeSort(id)}
                        prevCol={prevDef}
                        currentWidth={widthOf(id)}
                        prevWidth={prevId ? widthOf(prevId) : 0}
                        onResizeBoundary={(newThisWidth, newPrevWidth) => {
                          const updates: Partial<Record<CustomerColumnId, number>> = { [id]: newThisWidth };
                          if (prevId) updates[prevId] = newPrevWidth;
                          setMultiWidths(updates);
                        }}
                      />
                    );
                  })}
                </SortableContext>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const href = `/customers/${c.id}${preservedQuery ? `?${preservedQuery}` : ""}`;
                const isSelected = selected.has(c.id);
                return (
                  <tr
                    key={c.id}
                    className={cn(
                      "border-b last:border-0 hover:bg-brand-muted/40",
                      isSelected && "bg-brand-muted/60",
                    )}
                  >
                    {canBulkEdit ? (
                      <td className="px-3 py-2 align-middle border-r" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(v) => toggleOne(c.id, v === true)}
                          aria-label={`${c.name} 선택`}
                        />
                      </td>
                    ) : null}
                    {visibleIds.map((id) => (
                      <DataCell key={id} columnId={id} customer={c} href={href} canUnmaskPhone={canUnmaskPhone} />
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </DndContext>
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
            size="sm"
            variant="outline"
            onClick={() => setBulkDateOpen(true)}
          >
            <CalendarClock className="h-4 w-4" />
            DB 등록일 일괄 변경
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
        <>
          <BulkReassignDialog
            open={bulkOpen}
            onOpenChange={setBulkOpen}
            selectedCount={selected.size}
            selectedIds={selectedIds}
            agents={agents}
            onDone={clearSelection}
          />
          <BulkUpdateDateDialog
            open={bulkDateOpen}
            onOpenChange={setBulkDateOpen}
            selectedCount={selected.size}
            selectedIds={selectedIds}
            onDone={clearSelection}
          />
        </>
      ) : null}
    </>
  );
}

// ---------------- Sortable Header ----------------

function SortableHeader({
  col,
  sortDir,
  onSort,
  prevCol,
  currentWidth,
  prevWidth,
  onResizeBoundary,
}: {
  col: CustomerColumnDef;
  sortDir: SortDir | null;
  onSort: () => void;
  prevCol: CustomerColumnDef | null;
  currentWidth: number;
  prevWidth: number;
  /** 제로섬 리사이즈: 이 컬럼의 왼쪽 경계를 드래그하면 (이 컬럼, 이전 컬럼) 폭이 반대로 변화 */
  onResizeBoundary: (newThisWidth: number, newPrevWidth: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: col.id,
  });
  const startXRef = useRef<number>(0);
  const startThisRef = useRef<number>(0);
  const startPrevRef = useRef<number>(0);
  const resizingRef = useRef<boolean>(false);

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    position: "relative",
  };

  function startResize(e: React.PointerEvent) {
    if (!prevCol) return;
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = true;
    startXRef.current = e.clientX;
    startThisRef.current = currentWidth;
    startPrevRef.current = prevWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    function onMove(ev: PointerEvent) {
      if (!resizingRef.current || !prevCol) return;
      // 오른쪽으로 delta 만큼 끌면: 이전 컬럼 +delta, 이 컬럼 -delta
      // 각 컬럼의 minWidth 제약으로 delta 범위를 클램프
      let delta = ev.clientX - startXRef.current;
      const maxDeltaThisShrink = startThisRef.current - col.minWidth; // 이 컬럼이 줄어들 수 있는 최대
      const maxDeltaPrevShrink = startPrevRef.current - prevCol.minWidth; // 이전 컬럼이 줄어들 수 있는 최대
      if (delta > maxDeltaThisShrink) delta = maxDeltaThisShrink;
      if (delta < -maxDeltaPrevShrink) delta = -maxDeltaPrevShrink;
      onResizeBoundary(startThisRef.current - delta, startPrevRef.current + delta);
    }
    function onUp() {
      resizingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    }
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  }

  return (
    <th
      ref={setNodeRef}
      style={style}
      className={cn(
        "h-10 text-left align-middle border-b border-r last:border-r-0 bg-muted/50 select-none",
        isDragging && "z-20",
      )}
    >
      <div className="flex items-center justify-between gap-1 pl-2 pr-1 group">
        <button
          type="button"
          {...attributes}
          {...listeners}
          onClick={(e) => {
            // dnd-kit이 drag 인지 click 인지 distance로 판별 — 짧은 클릭은 click 이벤트로 도달
            if (col.sortable) onSort();
            e.preventDefault();
          }}
          className={cn(
            "flex flex-1 items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition",
            col.sortable && "cursor-pointer",
            !col.sortable && "cursor-grab",
          )}
          title={col.sortable ? "클릭: 정렬 / 드래그: 위치 변경" : "드래그: 위치 변경"}
        >
          <GripVertical className="h-3 w-3 shrink-0 opacity-30 group-hover:opacity-70 transition" />
          <span className="truncate">{col.label}</span>
          {col.sortable ? (
            sortDir === "asc" ? (
              <ArrowUp className="h-3 w-3 text-brand-accent" />
            ) : sortDir === "desc" ? (
              <ArrowDown className="h-3 w-3 text-brand-accent" />
            ) : (
              <ChevronsUpDown className="h-3 w-3 opacity-20 group-hover:opacity-50 transition" />
            )
          ) : null}
        </button>
      </div>
      {/* 왼쪽 가장자리 리사이즈 핸들 (첫 컬럼 제외) — 이 컬럼과 이전 컬럼 사이 경계 */}
      {prevCol ? (
        <span
          onPointerDown={startResize}
          onClick={(e) => e.stopPropagation()}
          className="absolute top-0 left-0 h-full w-1.5 -translate-x-1/2 cursor-col-resize hover:bg-brand/40 active:bg-brand/60 transition z-10"
          title="드래그하여 경계 조절"
          aria-label="컬럼 경계 조절"
        />
      ) : null}
    </th>
  );
}

// ---------------- Data Cell ----------------

function DataCell({
  columnId,
  customer,
  href,
  canUnmaskPhone,
}: {
  columnId: CustomerColumnId;
  customer: ListedCustomer;
  href: string;
  canUnmaskPhone: boolean;
}) {
  const content = renderCellContent(columnId, customer, canUnmaskPhone);
  const cls = cellClass(columnId);
  return (
    <td className={cn("px-3 py-2 align-middle truncate border-r last:border-r-0", cls)}>
      <Link href={href} className="block truncate" title={typeof content === "string" ? content : undefined}>
        {content}
      </Link>
    </td>
  );
}

function renderCellContent(
  id: CustomerColumnId,
  c: ListedCustomer,
  canUnmaskPhone: boolean,
): React.ReactNode {
  switch (id) {
    case "customerCode":
      return c.customerCode ?? "";
    case "agentName":
      return c.agentName ?? <span className="text-muted-foreground">미배정</span>;
    case "agentId":
      return c.agentId ?? <span className="text-muted-foreground">미배정</span>;
    case "name":
      return c.name;
    case "birthDate":
      return formatDate(c.birthDate);
    case "rrn": {
      const front = c.rrnFront ?? "";
      const back = c.rrnBack ?? "";
      if (!front && !back) return "";
      return `${front}${front && back ? "-" : ""}${back}`;
    }
    case "phone1":
      return canUnmaskPhone ? formatPhone(c.phone1) : maskPhone(c.phone1);
    case "job":
      return c.job ?? "";
    case "address":
      return c.address ?? "";
    case "addressDetail":
      return c.addressDetail ?? "";
    case "callResult":
      return <CallResultBadge value={c.callResult} />;
    case "dbProduct":
      return c.dbProduct ?? "";
    case "dbPremium":
      return c.dbPremium ? Number(c.dbPremium).toLocaleString("ko-KR") : "";
    case "dbHandler":
      return c.dbHandler ?? "";
    case "subCategory":
      return c.subCategory ?? "";
    case "dbPolicyNo":
      return c.dbPolicyNo ?? "";
    case "dbRegisteredAt":
      return formatDate(c.dbRegisteredAt);
    case "mainCategory":
      return c.mainCategory ?? "";
    case "dbStartAt":
      return formatDate(c.dbStartAt);
    case "branch":
      return c.branch ?? "";
    case "hq":
      return c.hq ?? "";
    case "team":
      return c.team ?? "";
    case "fax":
      return c.fax ?? "";
    case "reservationReceived":
      return formatDate(c.reservationReceived);
    case "dbCompany":
      return c.dbCompany ?? "";
    case "dbEndAt":
      return formatDate(c.dbEndAt);
    case "createdAt":
      return formatDateTime(c.createdAt);
    case "updatedAt":
      return formatDateTime(c.updatedAt);
  }
}

function cellClass(id: CustomerColumnId): string {
  switch (id) {
    case "name":
      return "font-medium";
    case "customerCode":
    case "phone1":
    case "rrn":
    case "fax":
    case "birthDate":
    case "dbStartAt":
    case "dbEndAt":
    case "dbRegisteredAt":
    case "reservationReceived":
    case "createdAt":
    case "updatedAt":
    case "agentId":
      return "font-mono tabular-nums text-sm";
    case "dbPremium":
      return "tabular-nums text-sm text-right";
    default:
      return "text-sm";
  }
}


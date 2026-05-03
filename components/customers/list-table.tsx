"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  ChevronsUpDown,
  GripVertical,
  Inbox,
  RotateCcw,
  Trash2,
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
import { Button } from "@/components/ui/button";
import { CallResultBadge } from "@/components/customers/call-result-badge";
import { BulkDeleteDialog } from "@/components/customers/bulk-delete-dialog";
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
  // 담당자 일괄 재할당(=매니저의 기본 권한 + admin). 체크박스 선택 + "담당자 일괄 변경" 버튼.
  canBulkReassign: boolean;
  // DB 등록일 일괄 변경(= admin 전용). "DB 등록일 일괄 변경" 버튼.
  canBulkDate: boolean;
  canBulkDelete: boolean;
  agents: Array<{ agentId: string; name: string }>;
  sort: SortKey | null;
  dir: SortDir;
};

export function ListTable({
  rows,
  showAgentColumn,
  preservedQuery,
  canUnmaskPhone,
  canBulkReassign,
  canBulkDate,
  canBulkDelete,
  agents,
  sort,
  dir,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { order, widths, setOrder, setMultiWidths, resetAll, hydrated } = useTablePrefs();

  const tableRef = useRef<HTMLTableElement | null>(null);
  const selectionRootRef = useRef<HTMLDivElement | null>(null);
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const selectedRef = useRef<Set<string>>(new Set());
  const [selectedCount, setSelectedCount] = useState(0);
  const [selectedIdsSnapshot, setSelectedIdsSnapshot] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkDateOpen, setBulkDateOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // 체크박스 컬럼은 어느 일괄 기능이든 하나라도 가능하면 노출.
  const canBulkEdit = canBulkReassign || canBulkDate || canBulkDelete;

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

  const syncSelectionCount = useCallback(() => {
    setSelectedCount(selectedRef.current.size);
  }, []);

  const toggleOne = useCallback((id: string, checked: boolean, row?: HTMLElement | null) => {
    if (checked) selectedRef.current.add(id);
    else selectedRef.current.delete(id);
    const root = selectionRootRef.current;
    if (root) {
      root.querySelectorAll<HTMLInputElement>("input[data-customer-select='true']").forEach((input) => {
        if (input.value !== id) return;
        input.checked = checked;
        const item = input.closest<HTMLElement>("[data-customer-row='true']");
        item?.classList.toggle("bg-brand/40", checked);
        item?.classList.toggle("hover:bg-brand/50", checked);
      });
    } else {
      row?.classList.toggle("bg-brand/40", checked);
      row?.classList.toggle("hover:bg-brand/50", checked);
    }
    syncSelectionCount();
  }, [syncSelectionCount]);

  function toggleAll(checked: boolean) {
    selectedRef.current = checked ? new Set(rows.map((r) => r.id)) : new Set();
    const root = selectionRootRef.current;
    if (root) {
      root.querySelectorAll<HTMLInputElement>("input[data-customer-select='true']").forEach((input) => {
        input.checked = checked;
        const item = input.closest<HTMLElement>("[data-customer-row='true']");
        item?.classList.toggle("bg-brand/40", checked);
        item?.classList.toggle("hover:bg-brand/50", checked);
      });
    }
    syncSelectionCount();
  }

  function clearSelection() {
    toggleAll(false);
  }

  function snapshotSelection() {
    const ids = Array.from(selectedRef.current);
    setSelectedIdsSnapshot(ids);
    return ids;
  }

  const allSelected = rows.length > 0 && selectedCount === rows.length;
  const someSelected = selectedCount > 0 && !allSelected;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected, selectedCount]);

  useEffect(() => {
    selectedRef.current = new Set();
    queueMicrotask(() => setSelectedCount(0));
    const root = selectionRootRef.current;
    if (root) {
      root.querySelectorAll<HTMLInputElement>("input[data-customer-select='true']").forEach((input) => {
        input.checked = false;
        const item = input.closest<HTMLElement>("[data-customer-row='true']");
        item?.classList.remove("bg-brand/40", "hover:bg-brand/50");
      });
    }
  }, [rows]);

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
      {/* flex-1 min-h-0 chain — 부모(customers/page) 의 flex-col 안에서 남는 세로 공간을 차지해
          내부 테이블 컨테이너가 viewport 안에서만 스크롤되도록. page-level 스크롤이 사라져
          sticky 헤더가 항상 viewport 상단에 보인다. */}
      <div ref={selectionRootRef} className="flex flex-col md:flex-1 md:min-h-0">
      <div className="hidden md:flex items-center justify-end gap-2 mb-2 text-xs text-muted-foreground shrink-0">
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

      {/* 내부 스크롤 컨테이너 — flex-1 min-h-0 로 부모의 남는 공간을 모두 차지.
          가로 스크롤바가 항상 viewport 하단에 위치하고 컬럼 헤더가 컨테이너 상단에 sticky 로 고정된다.
          한 페이지 행 수가 많아도(500) 헤더와 가로 스크롤이 멀어지지 않는다. */}
      <div className="md:hidden space-y-2 rounded-lg border bg-card p-2 shadow-sm">
        {rows.map((c) => (
          <MobileCustomerCard
            key={c.id}
            customer={c}
            preservedQuery={preservedQuery}
            canUnmaskPhone={canUnmaskPhone}
            canBulkEdit={canBulkEdit}
            showAgentColumn={showAgentColumn}
            onToggle={toggleOne}
          />
        ))}
      </div>

      <div className="hidden md:block flex-1 min-h-0 border bg-card shadow-sm overflow-auto">
        {/* id 고정 — @dnd-kit 의 자동 생성 sequential ID 가 SSR/Client 간 다르게 매겨져 hydration mismatch 발생.
            명시적 id 로 양쪽이 동일한 aria-describedby 값을 갖도록 강제. */}
        <DndContext
          id="customer-columns-dnd"
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <table ref={tableRef} className="w-full text-sm border-separate border-spacing-0 table-fixed" style={{ minWidth: 3600 }}>
            <colgroup>
              {canBulkEdit ? <col style={{ width: 40 }} /> : null}
              {visibleIds.map((id) => (
                <col key={id} style={{ width: widthOf(id) }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {canBulkEdit ? (
                  <th className="h-10 px-3 text-left align-middle border-b border-r bg-muted sticky top-0 z-20">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={allSelected}
                      onChange={(e) => toggleAll(e.currentTarget.checked)}
                      aria-label="현재 페이지 전체 선택"
                      className="h-4 w-4 accent-primary"
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
              {rows.map((c) => (
                <CustomerRow
                  key={c.id}
                  customer={c}
                  visibleIds={visibleIds}
                  preservedQuery={preservedQuery}
                  canUnmaskPhone={canUnmaskPhone}
                  canBulkEdit={canBulkEdit}
                  onToggle={toggleOne}
                />
              ))}
            </tbody>
          </table>
        </DndContext>
      </div>
      </div>

      {canBulkEdit && selectedCount > 0 ? (
        <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full border bg-background/95 backdrop-blur shadow-xl ring-1 ring-foreground/10 px-4 py-2 flex items-center gap-3 max-md:bottom-3 max-md:w-[calc(100vw-1rem)] max-md:max-w-none max-md:rounded-lg max-md:px-3 max-md:py-2 max-md:flex-wrap max-md:justify-center">
          <span className="text-sm font-medium">
            <b className="text-brand-accent tabular-nums">{selectedCount}</b>건 선택됨
          </span>
          {canBulkReassign ? (
            <Button
              type="button"
              size="sm"
              className="bg-brand text-brand-foreground hover:bg-brand-hover"
              onClick={() => {
                snapshotSelection();
                setBulkOpen(true);
              }}
            >
              <UserCog className="h-4 w-4" />
              담당자 일괄 변경
            </Button>
          ) : null}
          {canBulkDate ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                snapshotSelection();
                setBulkDateOpen(true);
              }}
            >
              <CalendarClock className="h-4 w-4" />
              DB 등록일 일괄 변경
            </Button>
          ) : null}
          {canBulkDelete ? (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => {
                snapshotSelection();
                setBulkDeleteOpen(true);
              }}
            >
              <Trash2 className="h-4 w-4" />
              선택 삭제
            </Button>
          ) : null}
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

      {canBulkReassign ? (
        <BulkReassignDialog
          open={bulkOpen}
          onOpenChange={setBulkOpen}
          selectedCount={selectedCount}
          selectedIds={selectedIdsSnapshot}
          agents={agents}
          onDone={clearSelection}
        />
      ) : null}
      {canBulkDate ? (
        <BulkUpdateDateDialog
          open={bulkDateOpen}
          onOpenChange={setBulkDateOpen}
          selectedCount={selectedCount}
          selectedIds={selectedIdsSnapshot}
          onDone={clearSelection}
        />
      ) : null}
      {canBulkDelete ? (
        <BulkDeleteDialog
          open={bulkDeleteOpen}
          onOpenChange={setBulkDeleteOpen}
          selectedCount={selectedCount}
          selectedIds={selectedIdsSnapshot}
          onDone={clearSelection}
        />
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
    // 인라인 position 은 의도적으로 비움 — Tailwind 의 `sticky top-0` 클래스가 적용되어
    // 컬럼 헤더가 스크롤 시 컨테이너 상단에 고정된다. 인라인 position:relative 를 두면
    // 클래스의 position:sticky 를 덮어써서 sticky 가 작동하지 않는다(과거 버그).
    // sticky 자체가 abs 자식의 positioning context 를 만들기 때문에 리사이즈 핸들의
    // absolute 배치는 그대로 동작한다.
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
        // sticky top-0 + 불투명 bg-muted 로 헤더 고정 — 반투명(bg-muted/50)이면 스크롤되는 행이 비쳐 가독성 ↓
        "h-10 text-left align-middle border-b border-r last:border-r-0 bg-muted select-none sticky top-0 z-20",
        // 드래그 중에는 다른 sticky th 들 위로 띄움
        isDragging && "z-30",
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

const CustomerRow = memo(function CustomerRow({
  customer,
  visibleIds,
  preservedQuery,
  canUnmaskPhone,
  canBulkEdit,
  onToggle,
}: {
  customer: ListedCustomer;
  visibleIds: CustomerColumnId[];
  preservedQuery: string;
  canUnmaskPhone: boolean;
  canBulkEdit: boolean;
  onToggle: (id: string, checked: boolean, row?: HTMLElement | null) => void;
}) {
  const href = `/customers/${customer.id}${preservedQuery ? `?${preservedQuery}` : ""}`;

  return (
    <tr data-customer-row="true" className="border-b last:border-0 hover:bg-brand/25">
      {canBulkEdit ? (
        <td className="px-3 py-2 align-middle border-r" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            value={customer.id}
            data-customer-select="true"
            onChange={(e) => onToggle(customer.id, e.currentTarget.checked, e.currentTarget.closest("tr"))}
            aria-label={`${customer.name} 선택`}
            className="h-4 w-4 accent-primary"
          />
        </td>
      ) : null}
      {visibleIds.map((id) => (
        <DataCell
          key={id}
          columnId={id}
          customer={customer}
          href={href}
          canUnmaskPhone={canUnmaskPhone}
        />
      ))}
    </tr>
  );
});

const MobileCustomerCard = memo(function MobileCustomerCard({
  customer,
  preservedQuery,
  canUnmaskPhone,
  canBulkEdit,
  showAgentColumn,
  onToggle,
}: {
  customer: ListedCustomer;
  preservedQuery: string;
  canUnmaskPhone: boolean;
  canBulkEdit: boolean;
  showAgentColumn: boolean;
  onToggle: (id: string, checked: boolean, row?: HTMLElement | null) => void;
}) {
  const href = `/customers/${customer.id}${preservedQuery ? `?${preservedQuery}` : ""}`;
  const phone = canUnmaskPhone ? formatPhone(customer.phone1) : maskPhone(customer.phone1);
  const agent = customer.agentName || customer.agentId;
  const address = [customer.address, customer.addressDetail].filter(Boolean).join(" ");

  return (
    <article
      data-customer-row="true"
      className="rounded-md border bg-background px-3 py-2 transition hover:bg-brand/20"
    >
      <div className="flex items-start gap-3">
        {canBulkEdit ? (
          <input
            type="checkbox"
            value={customer.id}
            data-customer-select="true"
            onChange={(e) => onToggle(customer.id, e.currentTarget.checked, e.currentTarget.closest("article"))}
            aria-label={`${customer.name} 선택`}
            className="mt-1 h-4 w-4 shrink-0 accent-primary"
          />
        ) : null}
        <Link href={href} className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <span className="truncate text-base font-semibold text-foreground">{customer.name}</span>
            <CallResultBadge value={customer.callResult} />
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {customer.customerCode ? <span className="tabular-nums">{customer.customerCode}</span> : null}
            {phone ? <span className="tabular-nums">{phone}</span> : null}
            {showAgentColumn ? <span>{agent || "미배정"}</span> : null}
          </div>
          {address ? (
            <div className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
              {address}
            </div>
          ) : null}
        </Link>
      </div>
    </article>
  );
});

const DataCell = memo(function DataCell({
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
});

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
    case "rrn":
      // 엑셀 원본 포맷과 동일하게 뒷자리 7자리만 표시.
      // 앞자리는 생년월일에서 파생되는 보조 데이터이므로 목록에 노출하지 않음.
      return c.rrnBack ?? "";
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


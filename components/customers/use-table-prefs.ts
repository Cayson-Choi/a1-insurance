"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CUSTOMER_COLUMNS,
  defaultColumnOrder,
  type CustomerColumnId,
  getColumnById,
} from "@/lib/customers/columns";

const STORAGE_KEY_ORDER = "jkcrm.customers.colOrder.v1";
const STORAGE_KEY_WIDTHS = "jkcrm.customers.colWidths.v1";

type Widths = Partial<Record<CustomerColumnId, number>>;

function readJSON<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJSON(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota / private mode 등 무시
  }
}

function sanitizeOrder(saved: unknown): CustomerColumnId[] {
  if (!Array.isArray(saved)) return defaultColumnOrder();
  const valid = new Set(CUSTOMER_COLUMNS.map((c) => c.id));
  const seen = new Set<CustomerColumnId>();
  const result: CustomerColumnId[] = [];
  for (const id of saved) {
    if (typeof id === "string" && valid.has(id as CustomerColumnId) && !seen.has(id as CustomerColumnId)) {
      result.push(id as CustomerColumnId);
      seen.add(id as CustomerColumnId);
    }
  }
  // 새로 추가된 컬럼이 저장본에 없을 수 있으므로 끝에 보충
  for (const c of CUSTOMER_COLUMNS) {
    if (!seen.has(c.id)) result.push(c.id);
  }
  return result;
}

function sanitizeWidths(saved: unknown): Widths {
  if (!saved || typeof saved !== "object") return {};
  const out: Widths = {};
  const map = saved as Record<string, unknown>;
  for (const c of CUSTOMER_COLUMNS) {
    const v = map[c.id];
    if (typeof v === "number" && Number.isFinite(v) && v >= c.minWidth && v <= 1200) {
      out[c.id] = Math.round(v);
    }
  }
  return out;
}

export function useTablePrefs() {
  // SSR-safe: 초기에는 default 사용 → mount 후 localStorage 반영
  const [order, setOrderState] = useState<CustomerColumnId[]>(defaultColumnOrder);
  const [widths, setWidthsState] = useState<Widths>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // localStorage 는 client-only — SSR 마크업과 mismatch 를 피하려면 mount 후 동기화해야 한다.
    // useSyncExternalStore 로 옮길 수도 있으나 이 hook 의 다른 setter (setOrder/setWidth 등)
    // 와 통일된 useState 패턴이 더 단순.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrderState(sanitizeOrder(readJSON(STORAGE_KEY_ORDER)));
    setWidthsState(sanitizeWidths(readJSON(STORAGE_KEY_WIDTHS)));
    setHydrated(true);
  }, []);

  const setOrder = useCallback((next: CustomerColumnId[]) => {
    const clean = sanitizeOrder(next);
    setOrderState(clean);
    writeJSON(STORAGE_KEY_ORDER, clean);
  }, []);

  const setWidth = useCallback((id: CustomerColumnId, w: number) => {
    setWidthsState((prev) => {
      const col = getColumnById(id);
      if (!col) return prev;
      const clamped = Math.max(col.minWidth, Math.min(1200, Math.round(w)));
      const next = { ...prev, [id]: clamped };
      writeJSON(STORAGE_KEY_WIDTHS, next);
      return next;
    });
  }, []);

  /** 여러 컬럼 폭을 원자적으로 갱신 — Excel 방식 리사이즈(제로섬)에서 사용 */
  const setMultiWidths = useCallback((updates: Widths) => {
    setWidthsState((prev) => {
      const next = { ...prev };
      for (const [k, v] of Object.entries(updates)) {
        if (typeof v !== "number" || !Number.isFinite(v)) continue;
        const col = getColumnById(k as CustomerColumnId);
        if (!col) continue;
        const clamped = Math.max(col.minWidth, Math.min(1200, Math.round(v)));
        next[k as CustomerColumnId] = clamped;
      }
      writeJSON(STORAGE_KEY_WIDTHS, next);
      return next;
    });
  }, []);

  const resetWidth = useCallback((id: CustomerColumnId) => {
    setWidthsState((prev) => {
      const next = { ...prev };
      delete next[id];
      writeJSON(STORAGE_KEY_WIDTHS, next);
      return next;
    });
  }, []);

  const resetAll = useCallback(() => {
    const order = defaultColumnOrder();
    setOrderState(order);
    setWidthsState({});
    writeJSON(STORAGE_KEY_ORDER, order);
    writeJSON(STORAGE_KEY_WIDTHS, {});
  }, []);

  return { order, widths, setOrder, setWidth, setMultiWidths, resetWidth, resetAll, hydrated };
}

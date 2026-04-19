// 고객 목록 테이블 컬럼 메타데이터.
// ListTable·queries·localStorage 모두 이 정의를 단일 출처로 사용한다.

export const SORT_KEYS = [
  "agentName",
  "name",
  "phone1",
  "birthDate",
  "address",
  "job",
  "callResult",
  "dbCompany",
  "dbEndAt",
] as const;

export type SortKey = (typeof SORT_KEYS)[number];
export type SortDir = "asc" | "desc";

export const DEFAULT_SORT: { key: SortKey | null; dir: SortDir } = {
  key: null, // null = 기본 정렬(dbRegisteredAt DESC, createdAt DESC)
  dir: "desc",
};

export type CustomerColumnId =
  | "agentName"
  | "name"
  | "phone1"
  | "birthDate"
  | "address"
  | "job"
  | "callResult"
  | "dbCompany"
  | "dbEndAt";

export type CustomerColumnDef = {
  id: CustomerColumnId;
  label: string;
  defaultWidth: number; // px
  minWidth: number;
  sortable: boolean;
  /** admin 전용 컬럼 — agent 권한이면 표시·재배치·정렬 대상에서 제외 */
  adminOnly?: boolean;
};

export const CUSTOMER_COLUMNS: readonly CustomerColumnDef[] = [
  { id: "agentName", label: "담당자", defaultWidth: 110, minWidth: 70, sortable: true, adminOnly: true },
  { id: "name", label: "이름", defaultWidth: 100, minWidth: 60, sortable: true },
  { id: "phone1", label: "연락처", defaultWidth: 150, minWidth: 110, sortable: true },
  { id: "birthDate", label: "생년월일", defaultWidth: 110, minWidth: 90, sortable: true },
  { id: "address", label: "주소", defaultWidth: 320, minWidth: 120, sortable: true },
  { id: "job", label: "직업", defaultWidth: 220, minWidth: 100, sortable: true },
  { id: "callResult", label: "통화결과", defaultWidth: 100, minWidth: 80, sortable: true },
  { id: "dbCompany", label: "보험사", defaultWidth: 110, minWidth: 80, sortable: true },
  { id: "dbEndAt", label: "DB 만기일", defaultWidth: 120, minWidth: 100, sortable: true },
] as const;

export function getColumnById(id: CustomerColumnId): CustomerColumnDef | undefined {
  return CUSTOMER_COLUMNS.find((c) => c.id === id);
}

export function defaultColumnOrder(): CustomerColumnId[] {
  return CUSTOMER_COLUMNS.map((c) => c.id);
}

export function isSortKey(v: unknown): v is SortKey {
  return typeof v === "string" && (SORT_KEYS as readonly string[]).includes(v);
}

export function isSortDir(v: unknown): v is SortDir {
  return v === "asc" || v === "desc";
}

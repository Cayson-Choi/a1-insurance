// 고객 목록 테이블 컬럼 메타데이터.
// 엑셀 28컬럼(고객명부.xlsx)과 1:1 매칭. ListTable·queries·localStorage 모두 이 정의를 단일 출처로 사용.

export const SORT_KEYS = [
  "customerCode",
  "agentName",
  "name",
  "birthDate",
  "rrn",
  "phone1",
  "job",
  "address",
  "callResult",
  "dbProduct",
  "dbPremium",
  "dbHandler",
  "subCategory",
  "dbPolicyNo",
  "dbRegisteredAt",
  "mainCategory",
  "dbStartAt",
  "branch",
  "hq",
  "team",
  "fax",
  "reservationReceived",
  "createdAt",
  "updatedAt",
  "dbCompany",
  "addressDetail",
  "dbEndAt",
  "agentId",
] as const;

export type SortKey = (typeof SORT_KEYS)[number];
export type SortDir = "asc" | "desc";

export const DEFAULT_SORT: { key: SortKey | null; dir: SortDir } = {
  key: null, // null = 기본 정렬(dbRegisteredAt DESC, createdAt DESC)
  dir: "desc",
};

export type CustomerColumnId = SortKey;

export type CustomerColumnDef = {
  id: CustomerColumnId;
  label: string;
  defaultWidth: number; // px
  minWidth: number;
  sortable: boolean;
  /** admin 전용 컬럼 — agent 권한이면 표시·재배치·정렬 대상에서 제외 */
  adminOnly?: boolean;
};

// 엑셀 28컬럼 순서에 맞춤. 각 label은 엑셀 헤더와 동일하게 유지.
export const CUSTOMER_COLUMNS: readonly CustomerColumnDef[] = [
  { id: "customerCode", label: "고객코드No", defaultWidth: 110, minWidth: 80, sortable: true },
  { id: "agentName", label: "담당자", defaultWidth: 110, minWidth: 70, sortable: true, adminOnly: true },
  { id: "name", label: "이름", defaultWidth: 100, minWidth: 60, sortable: true },
  { id: "birthDate", label: "생년월일", defaultWidth: 110, minWidth: 90, sortable: true },
  { id: "rrn", label: "주민No", defaultWidth: 160, minWidth: 120, sortable: true },
  { id: "phone1", label: "전화1", defaultWidth: 150, minWidth: 110, sortable: true },
  { id: "job", label: "직업", defaultWidth: 200, minWidth: 100, sortable: true },
  { id: "address", label: "주소", defaultWidth: 300, minWidth: 120, sortable: true },
  { id: "callResult", label: "통화결과", defaultWidth: 100, minWidth: 80, sortable: true },
  { id: "dbProduct", label: "DB상품명", defaultWidth: 160, minWidth: 100, sortable: true },
  { id: "dbPremium", label: "DB보험료", defaultWidth: 120, minWidth: 80, sortable: true },
  { id: "dbHandler", label: "DB취급자", defaultWidth: 110, minWidth: 80, sortable: true },
  { id: "subCategory", label: "소분류", defaultWidth: 110, minWidth: 80, sortable: true },
  { id: "dbPolicyNo", label: "DB증권No", defaultWidth: 140, minWidth: 100, sortable: true },
  { id: "dbRegisteredAt", label: "DB 등록일", defaultWidth: 120, minWidth: 100, sortable: true },
  { id: "mainCategory", label: "대분류", defaultWidth: 110, minWidth: 80, sortable: true },
  { id: "dbStartAt", label: "DB보험시작일", defaultWidth: 130, minWidth: 110, sortable: true },
  { id: "branch", label: "지사", defaultWidth: 100, minWidth: 70, sortable: true },
  { id: "hq", label: "본부", defaultWidth: 110, minWidth: 80, sortable: true },
  { id: "team", label: "소속팀", defaultWidth: 110, minWidth: 80, sortable: true },
  { id: "fax", label: "FAX", defaultWidth: 140, minWidth: 100, sortable: true },
  { id: "reservationReceived", label: "예약접수", defaultWidth: 120, minWidth: 100, sortable: true },
  { id: "createdAt", label: "등록일", defaultWidth: 120, minWidth: 100, sortable: true },
  { id: "updatedAt", label: "수정일", defaultWidth: 120, minWidth: 100, sortable: true },
  { id: "dbCompany", label: "DB회사명", defaultWidth: 120, minWidth: 80, sortable: true },
  { id: "addressDetail", label: "방문주소", defaultWidth: 240, minWidth: 120, sortable: true },
  { id: "dbEndAt", label: "DB보험만기일", defaultWidth: 130, minWidth: 110, sortable: true },
  { id: "agentId", label: "담당자ID", defaultWidth: 110, minWidth: 80, sortable: true, adminOnly: true },
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

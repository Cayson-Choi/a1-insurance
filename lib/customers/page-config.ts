// 페이지네이션 상수 — 서버·클라이언트 양쪽에서 안전하게 import 할 수 있도록
// DB 의존성 없이 분리. queries.ts(server) 와 pagination.tsx(client) 가 공통 사용.

export const DEFAULT_PER_PAGE = 20;
export const MAX_PER_PAGE = 500;

// 사용자가 페이지당 표시 개수 드롭다운에서 선택 가능한 5단계.
export const PER_PAGE_OPTIONS = [20, 50, 100, 200, 500] as const;
export type PerPageOption = (typeof PER_PAGE_OPTIONS)[number];

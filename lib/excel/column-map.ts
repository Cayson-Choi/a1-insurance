import type { NewCustomer } from "@/lib/db/schema";

export const CALL_RESULTS = ["예약", "부재", "가망", "거절", "결번", "민원"] as const;
export type CallResult = (typeof CALL_RESULTS)[number];

export const EXCEL_HEADERS = {
  customerCode: "고객코드No",
  agentName: "담당자",
  name: "이름",
  birthDate: "생년월일",
  rrnFrontRaw: "주민No",
  phone1: "전화1",
  job: "직업",
  address: "주소",
  callResult: "통화결과",
  dbProduct: "DB상품명",
  dbPremium: "DB보험료",
  dbHandler: "DB취급자",
  subCategory: "소분류",
  dbPolicyNo: "DB증권No",
  dbRegisteredAt: "DB 등록일",
  mainCategory: "대분류",
  dbStartAt: "DB보험시작일",
  branch: "지사",
  hq: "본부",
  team: "소속팀",
  fax: "FAX",
  reservationReceived: "예약접수",
  createdAtRaw: "등록일",
  updatedAtRaw: "수정일[]",
  dbCompany: "DB회사명",
  addressDetail: "방문주소",
  dbEndAt: "DB보험만기일",
  agentId: "담당자ID",
} as const;

export type ExcelRow = Record<string, unknown>;

// 과거 엑셀 파일 호환: "주소상세" 헤더도 "방문주소"와 동일하게 인식
const HEADER_ALIASES: Partial<Record<keyof typeof EXCEL_HEADERS, readonly string[]>> = {
  addressDetail: ["방문주소", "주소상세"],
};

function pickAlias(row: ExcelRow, key: keyof typeof EXCEL_HEADERS): unknown {
  const aliases = HEADER_ALIASES[key];
  if (aliases) {
    for (const h of aliases) {
      const v = row[h];
      if (v !== undefined && v !== null && v !== "") return v;
    }
  }
  return row[EXCEL_HEADERS[key]];
}

function isNil(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "number" && Number.isNaN(v)) return true;
  if (typeof v === "string" && v.trim() === "") return true;
  return false;
}

function str(v: unknown): string | null {
  if (isNil(v)) return null;
  return String(v).trim();
}

function numeric(v: unknown): string | null {
  if (isNil(v)) return null;
  const cleaned = String(v).replace(/,/g, "").trim();
  if (!cleaned || Number.isNaN(Number(cleaned))) return null;
  return cleaned;
}

function parseDate(v: unknown): Date | null {
  if (isNil(v)) return null;
  if (v instanceof Date) return Number.isNaN(v.valueOf()) ? null : v;
  const d = new Date(String(v));
  return Number.isNaN(d.valueOf()) ? null : d;
}

function dateOnly(v: unknown): string | null {
  const d = parseDate(v);
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

function callResult(v: unknown): CallResult | null {
  const s = str(v);
  if (!s) return null;
  return (CALL_RESULTS as readonly string[]).includes(s) ? (s as CallResult) : null;
}

function customerCode(v: unknown): string | null {
  if (isNil(v)) return null;
  if (typeof v === "number") {
    if (Number.isNaN(v)) return null;
    return v.toFixed(0);
  }
  return String(v).trim() || null;
}

/** 엑셀 "주민No" 컬럼에서 7자리 숫자 뒷자리만 깨끗하게 추출. 유효하지 않으면 null. */
export function extractRrnBackRaw(row: ExcelRow): string | null {
  const raw = row[EXCEL_HEADERS.rrnFrontRaw];
  if (isNil(raw)) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length !== 7) return null;
  // 샘플 placeholder(예: "1000000") 방어 — 7자리지만 모두 0이 붙은 건 제외
  if (/^1?0{6,}$/.test(digits)) return null;
  return digits;
}

/** 생년월일(YYYY-MM-DD) → 주민번호 앞자리 YYMMDD 변환. 없으면 null. */
export function birthDateToFrontYymmdd(birth: string | null): string | null {
  if (!birth) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(birth);
  if (!m) return null;
  return `${m[1].slice(2)}${m[2]}${m[3]}`;
}

export function rowToCustomer(row: ExcelRow): Omit<NewCustomer, "id"> {
  const h = EXCEL_HEADERS;
  return {
    customerCode: customerCode(row[h.customerCode]),
    agentId: str(row[h.agentId]),
    name: str(row[h.name]) ?? "이름없음",
    birthDate: dateOnly(row[h.birthDate]),
    phone1: str(row[h.phone1]),
    job: str(row[h.job]),
    address: str(row[h.address]),
    addressDetail: str(pickAlias(row, "addressDetail")),
    callResult: callResult(row[h.callResult]),
    dbProduct: str(row[h.dbProduct]),
    dbPremium: numeric(row[h.dbPremium]),
    dbHandler: str(row[h.dbHandler]),
    subCategory: str(row[h.subCategory]),
    dbPolicyNo: str(row[h.dbPolicyNo]),
    dbRegisteredAt: dateOnly(row[h.dbRegisteredAt]),
    mainCategory: str(row[h.mainCategory]),
    dbStartAt: dateOnly(row[h.dbStartAt]),
    branch: str(row[h.branch]),
    hq: str(row[h.hq]),
    team: str(row[h.team]),
    fax: str(row[h.fax]),
    reservationReceived: dateOnly(row[h.reservationReceived]),
    dbCompany: str(row[h.dbCompany]),
    dbEndAt: dateOnly(row[h.dbEndAt]),
  };
}

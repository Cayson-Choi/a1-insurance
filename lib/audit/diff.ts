const FIELD_LABELS: Record<string, string> = {
  name: "이름",
  phone1: "연락처",
  job: "직업",
  address: "원주소",
  addressDetail: "방문주소",
  callResult: "통화결과",
  dbCompany: "보험사",
  dbProduct: "보험상품명",
  dbStartAt: "가입일",
  reservationAt: "예약일시",
  memo: "메모",
  agentId: "담당자ID",
  rrnFrontSet: "주민번호 앞 등록",
  rrnBackSet: "주민번호 뒤 등록",
};

export type FieldChange = {
  field: string;
  label: string;
  before: string;
  after: string;
};

function toDisplay(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "O" : "X";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}

export function diffFields(
  before: unknown,
  after: unknown,
): FieldChange[] {
  if (!before || !after || typeof before !== "object" || typeof after !== "object") {
    return [];
  }
  const b = before as Record<string, unknown>;
  const a = after as Record<string, unknown>;
  const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
  const changes: FieldChange[] = [];
  for (const k of keys) {
    const bv = b[k];
    const av = a[k];
    if (toDisplay(bv) === toDisplay(av)) continue;
    changes.push({
      field: k,
      label: FIELD_LABELS[k] ?? k,
      before: toDisplay(bv),
      after: toDisplay(av),
    });
  }
  return changes;
}

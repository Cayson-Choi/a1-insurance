import ExcelJS from "exceljs";
import { rowToCustomer } from "@/lib/excel/column-map";
import type { NewCustomer } from "@/lib/db/schema";

export type ParsedRow = {
  rowNumber: number;
  raw: Record<string, unknown>;
  customer: Omit<NewCustomer, "id">;
  errors: string[];
};

export type ParsedWorkbook = {
  rows: ParsedRow[];
  headerErrors: string[];
  total: number;
};

const REQUIRED_HEADERS = ["이름"];

/**
 * 엑셀 버퍼를 파싱하여 고객 입력용 구조로 반환.
 * 유효성 검증은 row별로 기본 수준만: 이름 필수, 담당자ID 존재 여부는 호출측에서 검사.
 */
export async function parseCustomersWorkbook(
  buffer: ArrayBuffer,
): Promise<ParsedWorkbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const ws = wb.worksheets[0];
  if (!ws) {
    return { rows: [], headerErrors: ["시트를 찾을 수 없습니다."], total: 0 };
  }

  const headerRow = ws.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col] = String(cell.value ?? "").trim();
  });

  const headerErrors: string[] = [];
  for (const req of REQUIRED_HEADERS) {
    if (!headers.includes(req)) {
      headerErrors.push(`필수 헤더가 없습니다: ${req}`);
    }
  }

  const rows: ParsedRow[] = [];

  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const raw: Record<string, unknown> = {};
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      const key = headers[col];
      if (!key) return;
      let v: unknown = cell.value;
      if (v && typeof v === "object" && "text" in v) v = (v as { text: unknown }).text;
      if (v && typeof v === "object" && "result" in v) v = (v as { result: unknown }).result;
      raw[key] = v;
    });
    const customer = rowToCustomer(raw);
    const errs: string[] = [];
    if (!customer.name || customer.name === "이름없음") errs.push("이름이 비어있습니다");
    rows.push({ rowNumber, raw, customer, errors: errs });
  });

  return { rows, headerErrors, total: rows.length };
}

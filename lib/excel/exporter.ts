import ExcelJS from "exceljs";
import { EXCEL_HEADERS } from "@/lib/excel/column-map";
import type { Customer } from "@/lib/db/schema";

const HEADER_ORDER: Array<[keyof typeof EXCEL_HEADERS, number]> = [
  ["customerCode", 14],
  ["agentName", 10],
  ["name", 10],
  ["birthDate", 12],
  ["rrnFrontRaw", 16],
  ["phone1", 16],
  ["job", 30],
  ["address", 30],
  ["callResult", 10],
  ["dbProduct", 24],
  ["dbPremium", 12],
  ["dbHandler", 12],
  ["subCategory", 12],
  ["dbPolicyNo", 16],
  ["dbRegisteredAt", 14],
  ["mainCategory", 12],
  ["dbStartAt", 14],
  ["branch", 10],
  ["hq", 10],
  ["team", 10],
  ["fax", 14],
  ["reservationReceived", 14],
  ["createdAtRaw", 18],
  ["updatedAtRaw", 18],
  ["dbCompany", 12],
  ["addressDetail", 20],
  ["dbEndAt", 14],
  ["agentId", 10],
];

export type ExportRow = Customer & { agentName: string | null };

function toDateStr(v: Date | string | null): string {
  if (!v) return "";
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.valueOf())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Date → "YYYY-MM-DD HH:MM:SS" (**KST 기준**, 서버 TZ 무관).
 * Vercel 서버는 UTC 라서 getHours() 사용 시 한국 시각이 아니게 됨 → 명시적으로 +9 시간 오프셋 적용.
 */
function toDateTimeStr(v: Date | string | null | undefined): string {
  if (!v) return "";
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.valueOf())) return "";
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const mo = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(kst.getUTCDate()).padStart(2, "0");
  const hh = String(kst.getUTCHours()).padStart(2, "0");
  const mi = String(kst.getUTCMinutes()).padStart(2, "0");
  const ss = String(kst.getUTCSeconds()).padStart(2, "0");
  return `${y}-${mo}-${dd} ${hh}:${mi}:${ss}`;
}

export async function buildCustomersWorkbook(
  rows: ExportRow[],
): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "DB-CRM";
  wb.created = new Date();

  const ws = wb.addWorksheet("고객명부");
  ws.views = [{ state: "frozen", ySplit: 1 }];

  ws.columns = HEADER_ORDER.map(([key, width]) => ({
    header: EXCEL_HEADERS[key],
    key,
    width,
  }));

  // 헤더 스타일
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0891B2" },
  };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 24;

  for (const r of rows) {
    ws.addRow({
      customerCode: r.customerCode ?? "",
      agentName: r.agentName ?? "",
      name: r.name,
      birthDate: toDateStr(r.birthDate),
      // 원본 엑셀 포맷: "주민No" 컬럼은 뒤 7자리만. 앞자리(YYMMDD)는 생년월일 컬럼에서 파생.
      // 이 규칙을 유지해야 export → import 왕복 시 주민번호가 소실되지 않음.
      rrnFrontRaw: r.rrnBack ?? "",
      phone1: r.phone1 ?? "",
      job: r.job ?? "",
      address: r.address ?? "",
      callResult: r.callResult ?? "",
      dbProduct: r.dbProduct ?? "",
      dbPremium: r.dbPremium ? Number(r.dbPremium) : "",
      dbHandler: r.dbHandler ?? "",
      subCategory: r.subCategory ?? "",
      dbPolicyNo: r.dbPolicyNo ?? "",
      dbRegisteredAt: toDateStr(r.dbRegisteredAt),
      mainCategory: r.mainCategory ?? "",
      dbStartAt: toDateStr(r.dbStartAt),
      branch: r.branch ?? "",
      hq: r.hq ?? "",
      team: r.team ?? "",
      fax: r.fax ?? "",
      reservationReceived: toDateStr(r.reservationReceived),
      createdAtRaw: toDateTimeStr(r.createdAt),
      updatedAtRaw: toDateTimeStr(r.updatedAt),
      dbCompany: r.dbCompany ?? "",
      addressDetail: r.addressDetail ?? "",
      dbEndAt: toDateStr(r.dbEndAt),
      agentId: r.agentId ?? "",
    });
  }

  // 보험료 컬럼 숫자 포맷
  const premiumCol = ws.getColumn("dbPremium");
  premiumCol.numFmt = "#,##0";

  return wb;
}

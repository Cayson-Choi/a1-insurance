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

function toDateTimeStr(v: Date | string | null): string {
  if (!v) return "";
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.valueOf())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${toDateStr(d)} ${hh}:${mi}:${ss}`;
}

export async function buildCustomersWorkbook(
  rows: ExportRow[],
): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "JK-CRM";
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
      rrnFrontRaw: r.rrnFront && r.rrnBack ? `${r.rrnFront}-${r.rrnBack}` : (r.rrnBack ?? r.rrnFront ?? ""),
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

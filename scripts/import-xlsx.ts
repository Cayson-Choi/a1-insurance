import { config } from "dotenv";
import path from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import ExcelJS from "exceljs";
import { customers, users, type NewCustomer } from "@/lib/db/schema";
import {
  rowToCustomer,
  EXCEL_HEADERS,
  extractRrnBackRaw,
  birthDateToFrontYymmdd,
} from "@/lib/excel/column-map";
import { encryptPII, hashPII } from "@/lib/crypto/pii";
import { and, eq, isNull } from "drizzle-orm";

config({ path: ".env.local" });
config({ path: ".env" });

const FILE = process.argv[2] ?? path.resolve("material", "고객명부.xlsx");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  console.log(`Importing from: ${FILE}`);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(FILE);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("No worksheet found");

  // header row is row 1 — collect column names in order
  const headerRow = ws.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col] = String(cell.value ?? "").trim();
  });

  const rows: Record<string, unknown>[] = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj: Record<string, unknown> = {};
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      const key = headers[col];
      if (!key) return;
      let v: unknown = cell.value;
      // ExcelJS wraps hyperlinks/richText; unwrap
      if (v && typeof v === "object" && "text" in v) v = (v as { text: unknown }).text;
      if (v && typeof v === "object" && "result" in v) v = (v as { result: unknown }).result;
      obj[key] = v;
    });
    rows.push(obj);
  });

  console.log(`Read ${rows.length} rows, ${headers.filter(Boolean).length} columns`);
  console.log(`Expected agentId column: ${EXCEL_HEADERS.agentId}`);

  const sql = postgres(url, { max: 1, prepare: false });
  const db = drizzle(sql, { schema: { customers, users } });

  // prefetch known agentIds so FK doesn't fail on unknown
  const existingUsers = await db.query.users.findMany();
  const validAgentIds = new Set(existingUsers.map((u) => u.agentId));

  let inserted = 0;
  let updated = 0;
  let unknownAgent = 0;
  let rrnBackEnc = 0;
  let rrnFrontHashed = 0;

  for (const raw of rows) {
    const customer: Partial<NewCustomer> & ReturnType<typeof rowToCustomer> = rowToCustomer(raw);

    // if agentId not in users, set null to avoid FK violation
    if (customer.agentId && !validAgentIds.has(customer.agentId)) {
      unknownAgent++;
      customer.agentId = null;
    }

    // 주민번호 암호화 + 해시
    const back = extractRrnBackRaw(raw);
    if (back) {
      customer.rrnBackEnc = encryptPII(back);
      customer.rrnBackHash = hashPII(back);
      rrnBackEnc++;
    }
    const front = birthDateToFrontYymmdd(customer.birthDate ?? null);
    if (front) {
      customer.rrnFrontHash = hashPII(front);
      rrnFrontHashed++;
    }

    if (customer.customerCode) {
      const existing = await db.query.customers.findFirst({
        where: eq(customers.customerCode, customer.customerCode),
      });
      if (existing) {
        await db
          .update(customers)
          .set({ ...customer, updatedAt: new Date() })
          .where(eq(customers.id, existing.id));
        updated++;
        continue;
      }
    } else if (customer.name && customer.phone1) {
      const existing = await db.query.customers.findFirst({
        where: and(
          isNull(customers.customerCode),
          eq(customers.name, customer.name),
          eq(customers.phone1, customer.phone1),
        ),
      });
      if (existing) {
        await db
          .update(customers)
          .set({ ...customer, updatedAt: new Date() })
          .where(eq(customers.id, existing.id));
        updated++;
        continue;
      }
    }

    await db.insert(customers).values(customer as NewCustomer);
    inserted++;
  }

  console.log(
    `\n[완료] 입력 ${inserted}건 / 갱신 ${updated}건 / 미등록 담당자 ${unknownAgent}건 / 주민 암호화 ${rrnBackEnc}건 / 앞 해시 ${rrnFrontHashed}건`,
  );
  console.log("미등록 담당자가 있으면 scripts/seed.ts에 추가 후 다시 import 하세요.");

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

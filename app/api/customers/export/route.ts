import { NextRequest } from "next/server";
import { desc, eq, ilike, sql, and, SQL } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { customers, users } from "@/lib/db/schema";
import { requireUser, getPermissions } from "@/lib/auth/rbac";
import { parseFilter } from "@/lib/customers/queries";
import { buildCustomersWorkbook, type ExportRow } from "@/lib/excel/exporter";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await requireUser();
  const perms = await getPermissions(user.agentId);
  if (!perms?.canExport) {
    return new Response("엑셀 다운로드 권한이 없습니다.", { status: 403 });
  }

  const sp: Record<string, string> = {};
  req.nextUrl.searchParams.forEach((v, k) => {
    if (sp[k] === undefined) sp[k] = v;
  });
  const filter = parseFilter(sp);

  const conds: SQL[] = [];
  if (filter.agentId) conds.push(eq(customers.agentId, filter.agentId));
  if (filter.name) conds.push(ilike(customers.name, `%${filter.name}%`));
  if (filter.address) conds.push(ilike(customers.address, `%${filter.address}%`));
  if (filter.phone) {
    conds.push(sql`regexp_replace(coalesce(${customers.phone1}, ''), '[^0-9]', '', 'g') LIKE ${"%" + filter.phone + "%"}`);
  }
  if (filter.callResult) conds.push(eq(customers.callResult, filter.callResult));
  if (filter.rrnFront) conds.push(eq(customers.rrnFront, filter.rrnFront));
  if (filter.rrnBack) conds.push(eq(customers.rrnBack, filter.rrnBack));
  if (filter.birthYearFrom !== undefined) {
    conds.push(sql`extract(year from ${customers.birthDate}) >= ${filter.birthYearFrom}`);
  }
  if (filter.birthYearTo !== undefined) {
    conds.push(sql`extract(year from ${customers.birthDate}) <= ${filter.birthYearTo}`);
  }

  const rows = await db
    .select({
      customer: customers,
      agentName: users.name,
    })
    .from(customers)
    .leftJoin(users, eq(customers.agentId, users.agentId))
    .where(conds.length ? and(...conds) : sql`true`)
    .orderBy(desc(customers.dbRegisteredAt), desc(customers.createdAt));

  const exportRows: ExportRow[] = rows.map((r) => ({
    ...r.customer,
    agentName: r.agentName,
  }));

  const wb = await buildCustomersWorkbook(exportRows);
  const buffer = await wb.xlsx.writeBuffer();

  const now = new Date();
  const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
  const filename = `JG-ORM_고객명부_${ts}.xlsx`;

  return new Response(buffer as ArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}

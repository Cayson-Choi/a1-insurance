import { NextRequest } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { customers, users } from "@/lib/db/schema";
import { requireUser, getPermissions } from "@/lib/auth/rbac";
import { parseFilter, buildWhere } from "@/lib/customers/queries";
import { buildCustomersWorkbook, type ExportRow } from "@/lib/excel/exporter";
import { getStoredRrnBack } from "@/lib/security/pii";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const user = await requireUser();
  const perms = await getPermissions(user.agentId);
  if (!perms?.canExport) {
    return new Response("엑셀 다운로드 권한이 없습니다.", {
      status: 403,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const sp: Record<string, string> = {};
  req.nextUrl.searchParams.forEach((v, k) => {
    if (sp[k] === undefined) sp[k] = v;
  });
  const filter = parseFilter(sp);

  // RBAC 스코프 적용 — agent 는 본인 담당분만, manager·admin 은 전체.
  // 자체 conds[] 를 만들면 권한 WHERE 가 빠져 agent 가 canExport 만으로 전체 데이터를 받을 수 있음.
  const where = buildWhere(filter, user);

  const rows = await db
    .select({
      customer: customers,
      agentName: users.name,
    })
    .from(customers)
    .leftJoin(users, eq(customers.agentId, users.agentId))
    .where(where ?? sql`true`)
    .orderBy(desc(customers.dbRegisteredAt), desc(customers.createdAt));

  const exportRows: ExportRow[] = rows.map((r) => ({
    ...r.customer,
    rrnFront: null,
    rrnBack: getStoredRrnBack(r.customer),
    agentName: r.agentName,
  }));

  const wb = await buildCustomersWorkbook(exportRows);
  const buffer = await wb.xlsx.writeBuffer();

  const now = new Date();
  const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
  const filename = `DB-CRM_고객명부_${ts}.xlsx`;

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

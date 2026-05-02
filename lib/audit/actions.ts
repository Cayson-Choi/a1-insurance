"use server";

import { revalidatePath } from "next/cache";
import { inArray } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/rbac";
import { db } from "@/lib/db/client";
import { auditLogs } from "@/lib/db/schema";
import { normalizeUuidList } from "@/lib/security/ids";

const MAX_DELETE_RECORDS = 500;

type DeleteAuditLogsResult =
  | { ok: true; deleted: number }
  | { ok: false; error: string };

export async function deleteAuditLogsAction(
  ids: string[],
): Promise<DeleteAuditLogsResult> {
  await requireAdmin();

  const validIds = normalizeUuidList(ids, MAX_DELETE_RECORDS);
  if (!validIds) {
    return { ok: false, error: "Invalid audit log selection." };
  }

  const deleted = await db
    .delete(auditLogs)
    .where(inArray(auditLogs.id, validIds));

  revalidatePath("/admin/audit");
  return { ok: true, deleted: deleted.count };
}

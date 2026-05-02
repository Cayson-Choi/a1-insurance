"use server";

import { revalidatePath } from "next/cache";
import { inArray } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/rbac";
import { db } from "@/lib/db/client";
import { loginEvents } from "@/lib/db/schema";
import { normalizeUuidList } from "@/lib/security/ids";

const MAX_DELETE_RECORDS = 500;

type DeleteLoginEventsResult =
  | { ok: true; deleted: number }
  | { ok: false; error: string };

export async function deleteLoginEventsAction(
  ids: string[],
): Promise<DeleteLoginEventsResult> {
  await requireAdmin();

  const validIds = normalizeUuidList(ids, MAX_DELETE_RECORDS);
  if (!validIds) {
    return { ok: false, error: "Invalid login event selection." };
  }

  const deleted = await db
    .delete(loginEvents)
    .where(inArray(loginEvents.id, validIds));

  revalidatePath("/admin/logins");
  return { ok: true, deleted: deleted.count };
}

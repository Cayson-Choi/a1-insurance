"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { customers, auditLogs, users } from "@/lib/db/schema";
import { requireUser, requireAdmin } from "@/lib/auth/rbac";
import { UpdateCustomerSchema } from "@/lib/customers/schema";
import { encryptPII, hashPII, decryptPII } from "@/lib/crypto/pii";
import {
  getCustomerDetail,
  getDetailContext,
  type CustomerDetail,
  type DetailContext,
} from "@/lib/customers/get-detail";

type UpdateResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function updateCustomerAction(
  id: string,
  formData: FormData,
): Promise<UpdateResult> {
  const user = await requireUser();

  const raw = Object.fromEntries(formData.entries());
  const parsed = UpdateCustomerSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return { ok: false, error: "입력값을 확인해주세요.", fieldErrors };
  }

  const existing = await db.query.customers.findFirst({
    where: eq(customers.id, id),
  });
  if (!existing) return { ok: false, error: "고객을 찾을 수 없습니다." };
  if (user.role === "agent" && existing.agentId !== user.agentId) {
    return { ok: false, error: "해당 고객에 대한 권한이 없습니다." };
  }

  const data = parsed.data;
  const agentChange =
    user.role === "admin" &&
    data.agentId !== undefined &&
    data.agentId !== existing.agentId;

  if (agentChange && data.agentId !== null) {
    const target = await db.query.users.findFirst({
      where: eq(users.agentId, data.agentId),
    });
    if (!target) return { ok: false, error: "존재하지 않는 담당자ID 입니다." };
  }

  const patch: Partial<typeof customers.$inferInsert> = {
    name: data.name,
    phone1: data.phone1,
    job: data.job,
    address: data.address,
    addressDetail: data.addressDetail,
    callResult: data.callResult ?? null,
    dbCompany: data.dbCompany,
    dbProduct: data.dbProduct,
    dbStartAt: data.dbStartAt,
    reservationAt: data.reservationAt ? new Date(data.reservationAt) : null,
    memo: data.memo,
    updatedAt: new Date(),
  };

  if (data.rrnFront !== undefined) {
    patch.rrnFrontHash = data.rrnFront ? hashPII(data.rrnFront) : null;
  }
  if (data.rrnBack !== undefined) {
    patch.rrnBackHash = data.rrnBack ? hashPII(data.rrnBack) : null;
    patch.rrnBackEnc = data.rrnBack ? encryptPII(data.rrnBack) : null;
  }

  if (user.role === "admin" && data.agentId !== undefined) {
    patch.agentId = data.agentId;
  }

  await db.update(customers).set(patch).where(eq(customers.id, id));

  const beforeSnapshot = {
    name: existing.name,
    phone1: existing.phone1,
    job: existing.job,
    address: existing.address,
    addressDetail: existing.addressDetail,
    callResult: existing.callResult,
    dbCompany: existing.dbCompany,
    dbProduct: existing.dbProduct,
    dbStartAt: existing.dbStartAt,
    reservationAt: existing.reservationAt?.toISOString() ?? null,
    memo: existing.memo,
    agentId: existing.agentId,
    rrnFrontSet: !!existing.rrnFrontHash,
    rrnBackSet: !!existing.rrnBackHash,
  };
  const afterSnapshot = {
    ...beforeSnapshot,
    name: patch.name ?? existing.name,
    phone1: patch.phone1 ?? existing.phone1,
    job: patch.job ?? existing.job,
    address: patch.address ?? existing.address,
    addressDetail: patch.addressDetail ?? existing.addressDetail,
    callResult: patch.callResult ?? existing.callResult,
    dbCompany: patch.dbCompany ?? existing.dbCompany,
    dbProduct: patch.dbProduct ?? existing.dbProduct,
    dbStartAt: patch.dbStartAt ?? existing.dbStartAt,
    reservationAt:
      patch.reservationAt instanceof Date ? patch.reservationAt.toISOString() : existing.reservationAt?.toISOString() ?? null,
    memo: patch.memo ?? existing.memo,
    agentId: patch.agentId ?? existing.agentId,
    rrnFrontSet: patch.rrnFrontHash !== undefined ? !!patch.rrnFrontHash : !!existing.rrnFrontHash,
    rrnBackSet: patch.rrnBackHash !== undefined ? !!patch.rrnBackHash : !!existing.rrnBackHash,
  };

  await db.insert(auditLogs).values({
    actorAgentId: user.agentId,
    customerId: id,
    action: agentChange ? "agent_change" : "edit",
    before: beforeSnapshot,
    after: afterSnapshot,
  });

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);

  return { ok: true };
}

type RevealResult =
  | { ok: true; front: string; back: string }
  | { ok: false; error: string };

/**
 * 관리자가 고객 주민번호를 1회성으로 복호화하여 본다.
 * 반드시 audit_log에 action=rrn_decrypt 로 기록된다.
 */
export async function revealRrnAction(id: string, reason?: string): Promise<RevealResult> {
  const actor = await requireAdmin();

  const row = await db.query.customers.findFirst({
    where: eq(customers.id, id),
  });
  if (!row) return { ok: false, error: "고객을 찾을 수 없습니다." };

  if (!row.rrnBackEnc) {
    return { ok: false, error: "주민번호가 등록되어 있지 않습니다." };
  }

  let back: string;
  try {
    const dec = decryptPII(row.rrnBackEnc);
    if (!dec) throw new Error("decryption returned null");
    back = dec;
  } catch {
    return { ok: false, error: "복호화에 실패했습니다. 암호화 키를 확인하세요." };
  }

  // 앞자리는 생년월일에서 파생 (YYMMDD)
  let front = "??????";
  if (row.birthDate) {
    const s = String(row.birthDate);
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (m) front = `${m[1].slice(2)}${m[2]}${m[3]}`;
  }

  await db.insert(auditLogs).values({
    actorAgentId: actor.agentId,
    customerId: id,
    action: "rrn_decrypt",
    before: null,
    after: { customerName: row.name, reason: reason ?? null },
  });

  return { ok: true, front, back };
}

type BulkResult =
  | { ok: true; updated: number; newAgentId: string | null }
  | { ok: false; error: string };

export async function bulkReassignAction(
  customerIds: string[],
  targetAgentId: string | null,
): Promise<BulkResult> {
  const actor = await requireAdmin();
  if (!customerIds.length) return { ok: false, error: "선택된 고객이 없습니다." };

  const newAgent: string | null = targetAgentId && targetAgentId.trim() ? targetAgentId.trim() : null;

  if (newAgent) {
    const target = await db.query.users.findFirst({
      where: eq(users.agentId, newAgent),
    });
    if (!target) return { ok: false, error: "존재하지 않는 담당자ID 입니다." };
  }

  const existing = await db
    .select({ id: customers.id, agentId: customers.agentId })
    .from(customers)
    .where(inArray(customers.id, customerIds));

  if (!existing.length) {
    return { ok: false, error: "대상 고객을 찾을 수 없습니다." };
  }

  await db
    .update(customers)
    .set({ agentId: newAgent, updatedAt: new Date() })
    .where(inArray(customers.id, customerIds));

  await db.insert(auditLogs).values(
    existing.map((c) => ({
      actorAgentId: actor.agentId,
      customerId: c.id,
      action: "bulk_change" as const,
      before: { agentId: c.agentId },
      after: { agentId: newAgent },
    })),
  );

  revalidatePath("/customers");
  return { ok: true, updated: existing.length, newAgentId: newAgent };
}

type FetchResult =
  | { ok: true; customer: CustomerDetail; context: DetailContext }
  | { ok: false; error: string };

export async function fetchCustomerAction(
  id: string,
  searchParams: Record<string, string>,
): Promise<FetchResult> {
  const user = await requireUser();
  const [customer, context] = await Promise.all([
    getCustomerDetail(id, user),
    getDetailContext(id, searchParams, user),
  ]);
  if (!customer) return { ok: false, error: "고객을 찾을 수 없습니다." };
  return { ok: true, customer, context };
}

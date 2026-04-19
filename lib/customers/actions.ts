"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { customers, auditLogs, users } from "@/lib/db/schema";
import { requireUser, requireAdmin, getPermissions } from "@/lib/auth/rbac";
import { UpdateCustomerSchema } from "@/lib/customers/schema";
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
  const perms = await getPermissions(user.agentId);
  const canFullEdit = !!perms?.canEdit;

  const raw = Object.fromEntries(formData.entries());
  const parsed = UpdateCustomerSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.map(String).join(".");
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
    canFullEdit &&
    user.role === "admin" &&
    data.agentId !== undefined &&
    data.agentId !== existing.agentId;

  if (agentChange && data.agentId !== null) {
    const target = await db.query.users.findFirst({
      where: eq(users.agentId, data.agentId),
    });
    if (!target) return { ok: false, error: "존재하지 않는 담당자ID 입니다." };
  }

  // canEdit 있으면 모든 필드, 없으면 방문주소·메모·통화결과만 화이트리스트
  const patch: Partial<typeof customers.$inferInsert> = canFullEdit
    ? {
        name: data.name,
        phone1: data.phone1,
        job: data.job,
        address: data.address,
        addressDetail: data.addressDetail,
        birthDate: data.birthDate,
        callResult: data.callResult ?? null,
        dbCompany: data.dbCompany,
        dbProduct: data.dbProduct,
        dbPremium: data.dbPremium,
        subCategory: data.subCategory,
        dbStartAt: data.dbStartAt,
        dbEndAt: data.dbEndAt,
        dbRegisteredAt: data.dbRegisteredAt,
        reservationAt: data.reservationAt ? new Date(data.reservationAt) : null,
        memo: data.memo,
        branch: data.branch,
        hq: data.hq,
        team: data.team,
        updatedAt: new Date(),
      }
    : {
        addressDetail: data.addressDetail,
        callResult: data.callResult ?? null,
        memo: data.memo,
        updatedAt: new Date(),
      };

  if (canFullEdit) {
    if (data.rrnFront !== undefined) {
      patch.rrnFront = data.rrnFront;
    } else if (data.birthDate !== undefined) {
      if (data.birthDate) {
        const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(data.birthDate);
        if (m) patch.rrnFront = `${m[1].slice(2)}${m[2]}${m[3]}`;
      } else {
        patch.rrnFront = null;
      }
    }
    if (data.rrnBack !== undefined) {
      patch.rrnBack = data.rrnBack;
    }
    if (user.role === "admin" && data.agentId !== undefined) {
      patch.agentId = data.agentId;
    }
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
    rrnFront: existing.rrnFront,
    rrnBack: existing.rrnBack,
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
    rrnFront: patch.rrnFront ?? existing.rrnFront,
    rrnBack: patch.rrnBack ?? existing.rrnBack,
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

type DeleteResult = { ok: true } | { ok: false; error: string };

export async function deleteCustomerAction(id: string): Promise<DeleteResult> {
  const user = await requireUser();
  const perms = await getPermissions(user.agentId);
  if (!perms?.canDelete) {
    return { ok: false, error: "삭제 권한이 없습니다. 관리자에게 문의하세요." };
  }

  const existing = await db.query.customers.findFirst({
    where: eq(customers.id, id),
  });
  if (!existing) return { ok: false, error: "고객을 찾을 수 없습니다." };
  if (user.role === "agent" && existing.agentId !== user.agentId) {
    return { ok: false, error: "해당 고객에 대한 권한이 없습니다." };
  }

  // 감사로그 먼저 기록 (삭제 후 customer_id 참조 가능하도록 CASCADE 없이 남겨둠)
  await db.insert(auditLogs).values({
    actorAgentId: user.agentId,
    customerId: id,
    action: "edit",
    before: {
      deleted: false,
      name: existing.name,
      phone1: existing.phone1,
      agentId: existing.agentId,
    },
    after: { deleted: true },
  });

  await db.delete(customers).where(eq(customers.id, id));

  revalidatePath("/customers");
  return { ok: true };
}

// revealRrnAction 제거 — 주민번호는 평문으로 저장·표시되므로 별도 복호화 불필요

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

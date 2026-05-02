"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { customers, auditLogs, users } from "@/lib/db/schema";
import {
  requireUser,
  requireAdmin,
  requireAdminOrManager,
  getPermissions,
  canSeeAllCustomers,
  canReassignAgent,
} from "@/lib/auth/rbac";
import { UpdateCustomerSchema } from "@/lib/customers/schema";
import { isUuid, normalizeUuidList } from "@/lib/security/ids";
import { redactAuditPayload } from "@/lib/security/audit";
import {
  encodeRrnBackFields,
  encodeRrnFields,
  getStoredRrnBack,
} from "@/lib/security/pii";

const MAX_BULK_CUSTOMERS = 500;

type UpdateResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function updateCustomerAction(
  id: string,
  formData: FormData,
): Promise<UpdateResult> {
  if (!isUuid(id)) {
    return { ok: false, error: "Invalid customer id." };
  }

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
  // admin·manager 는 전체 고객 편집, agent 는 본인 담당분만.
  if (!canSeeAllCustomers(user) && existing.agentId !== user.agentId) {
    return { ok: false, error: "해당 고객에 대한 권한이 없습니다." };
  }

  const data = parsed.data;
  // 담당자 재할당은 매니저의 "기본 권한" — canEdit 플래그와 무관하게 admin 또는 manager 면 가능.
  // (UI 에서는 매니저에게 canEdit 미부여 시에도 담당자 드롭다운은 열어두고, 나머지 필드는 readOnly 로 막힘.)
  const agentChange =
    canReassignAgent(user) &&
    data.agentId !== undefined &&
    data.agentId !== existing.agentId;

  if (agentChange && data.agentId !== null) {
    const target = await db.query.users.findFirst({
      where: eq(users.agentId, data.agentId),
    });
    if (!target) return { ok: false, error: "존재하지 않는 담당자ID 입니다." };
  }

  // canEdit 있으면 모든 필드, 없으면 방문주소·메모·통화결과·예약일시만 화이트리스트
  // (영업 현장에서 권한 없는 담당자도 전화통화 중 즉시 예약을 잡을 수 있어야 함.)
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
        reservationAt: data.reservationAt ? new Date(data.reservationAt) : null,
        updatedAt: new Date(),
      };

  if (canFullEdit) {
    // rrnFront 는 UI 에서 입력 필드 제거됨 → birthDate 가 제공되면 거기서 자동 파생.
    // 빈 birthDate 일 때 기존 rrnFront 를 지우지 않음 (엑셀 import 로만 채워진 케이스 보호).
    let rrnFront = data.rrnFront;
    if (rrnFront === undefined && data.birthDate) {
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(data.birthDate);
      if (m) rrnFront = `${m[1].slice(2)}${m[2]}${m[3]}`;
    }
    if (rrnFront !== undefined) {
      Object.assign(
        patch,
        encodeRrnFields({
          rrnFront,
          rrnBack: data.rrnBack === undefined ? getStoredRrnBack(existing) : data.rrnBack,
        }),
      );
    } else if (data.rrnBack !== undefined) {
      Object.assign(patch, encodeRrnBackFields(data.rrnBack));
    }
  }

  // 담당자 재할당은 canEdit 과 독립적: admin 은 물론, manager 도 (canEdit 미부여 상태에서)
  // 오로지 담당자만 바꾸는 시나리오가 있어야 하므로 블록 밖에서 처리.
  if (canReassignAgent(user) && data.agentId !== undefined) {
    patch.agentId = data.agentId;
  }

  // 감사로그 스냅샷: 편집 가능한 모든 필드를 포함하여 변경 이력이 완전하게 남도록 함.
  // `patch` 에 없는 키는 기존 값을 그대로 보존(변화 없음 = diff 결과에서 자연히 제외됨).
  const beforeSnapshot = {
    name: existing.name,
    phone1: existing.phone1,
    job: existing.job,
    address: existing.address,
    addressDetail: existing.addressDetail,
    birthDate: existing.birthDate,
    callResult: existing.callResult,
    dbCompany: existing.dbCompany,
    dbProduct: existing.dbProduct,
    dbPremium: existing.dbPremium,
    subCategory: existing.subCategory,
    dbStartAt: existing.dbStartAt,
    dbEndAt: existing.dbEndAt,
    dbRegisteredAt: existing.dbRegisteredAt,
    reservationAt: existing.reservationAt?.toISOString() ?? null,
    memo: existing.memo,
    branch: existing.branch,
    hq: existing.hq,
    team: existing.team,
    agentId: existing.agentId,
    rrnFront: null,
    rrnBack: getStoredRrnBack(existing),
  };
  const afterSnapshot = {
    ...beforeSnapshot,
    name: patch.name ?? existing.name,
    phone1: patch.phone1 ?? existing.phone1,
    job: patch.job ?? existing.job,
    address: patch.address ?? existing.address,
    addressDetail: patch.addressDetail ?? existing.addressDetail,
    birthDate: patch.birthDate ?? existing.birthDate,
    callResult: patch.callResult ?? existing.callResult,
    dbCompany: patch.dbCompany ?? existing.dbCompany,
    dbProduct: patch.dbProduct ?? existing.dbProduct,
    dbPremium: patch.dbPremium ?? existing.dbPremium,
    subCategory: patch.subCategory ?? existing.subCategory,
    dbStartAt: patch.dbStartAt ?? existing.dbStartAt,
    dbEndAt: patch.dbEndAt ?? existing.dbEndAt,
    dbRegisteredAt: patch.dbRegisteredAt ?? existing.dbRegisteredAt,
    reservationAt:
      patch.reservationAt instanceof Date ? patch.reservationAt.toISOString() : existing.reservationAt?.toISOString() ?? null,
    memo: patch.memo ?? existing.memo,
    branch: patch.branch ?? existing.branch,
    hq: patch.hq ?? existing.hq,
    team: patch.team ?? existing.team,
    agentId: patch.agentId ?? existing.agentId,
    rrnFront: null,
    rrnBack:
      patch.rrnBackEnc !== undefined
        ? getStoredRrnBack(patch)
        : getStoredRrnBack(existing),
  };

  // UPDATE 와 audit INSERT 를 한 트랜잭션으로 묶어 원자성 보장.
  // 도중 실패 시 둘 다 롤백되어 데이터/감사로그 불일치 차단.
  await db.transaction(async (tx) => {
    await tx.update(customers).set(patch).where(eq(customers.id, id));
    await tx.insert(auditLogs).values({
      actorAgentId: user.agentId,
      customerId: id,
      action: agentChange ? "agent_change" : "edit",
      before: redactAuditPayload(beforeSnapshot),
      after: redactAuditPayload(afterSnapshot),
    });
  });

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);

  return { ok: true };
}

type DeleteResult = { ok: true } | { ok: false; error: string };

export async function deleteCustomerAction(id: string): Promise<DeleteResult> {
  if (!isUuid(id)) {
    return { ok: false, error: "Invalid customer id." };
  }

  const user = await requireUser();
  const perms = await getPermissions(user.agentId);
  if (!perms?.canDelete) {
    return { ok: false, error: "삭제 권한이 없습니다. 관리자에게 문의하세요." };
  }

  const existing = await db.query.customers.findFirst({
    where: eq(customers.id, id),
  });
  if (!existing) return { ok: false, error: "고객을 찾을 수 없습니다." };
  // admin·manager 는 전체 대상 삭제 가능, agent 는 본인 담당분만.
  if (!canSeeAllCustomers(user) && existing.agentId !== user.agentId) {
    return { ok: false, error: "해당 고객에 대한 권한이 없습니다." };
  }

  // 감사로그 + 삭제를 한 트랜잭션으로 — 삭제 후 customer_id 참조를 위해 audit 가 먼저 기록되어야 하고,
  // 둘 중 하나만 실패하면 일관성이 깨지므로 트랜잭션으로 묶음.
  await db.transaction(async (tx) => {
    await tx.insert(auditLogs).values({
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
    await tx.delete(customers).where(eq(customers.id, id));
  });

  revalidatePath("/customers");
  return { ok: true };
}

type BulkDeleteResult =
  | { ok: true; deleted: number }
  | { ok: false; error: string };

export async function bulkDeleteCustomersAction(
  customerIds: string[],
): Promise<BulkDeleteResult> {
  const actor = await requireUser();
  const perms = await getPermissions(actor.agentId);
  if (!perms?.canDelete) {
    return { ok: false, error: "삭제 권한이 없습니다. 관리자에게 문의하세요." };
  }

  const validCustomerIds = normalizeUuidList(customerIds, MAX_BULK_CUSTOMERS);
  if (!validCustomerIds) {
    return { ok: false, error: "Invalid customer selection." };
  }

  const existing = await db
    .select({
      id: customers.id,
      name: customers.name,
      phone1: customers.phone1,
      agentId: customers.agentId,
    })
    .from(customers)
    .where(inArray(customers.id, validCustomerIds));

  if (!existing.length) {
    return { ok: false, error: "삭제할 고객을 찾을 수 없습니다." };
  }

  if (!canSeeAllCustomers(actor) && existing.some((c) => c.agentId !== actor.agentId)) {
    return { ok: false, error: "선택한 고객 중 삭제 권한이 없는 고객이 포함되어 있습니다." };
  }

  const existingIds = existing.map((c) => c.id);

  await db.transaction(async (tx) => {
    await tx.insert(auditLogs).values(
      existing.map((c) => ({
        actorAgentId: actor.agentId,
        customerId: c.id,
        action: "bulk_change" as const,
        before: redactAuditPayload({
          deleted: false,
          name: c.name,
          phone1: c.phone1,
          agentId: c.agentId,
        }),
        after: { deleted: true },
      })),
    );
    await tx.delete(customers).where(inArray(customers.id, existingIds));
  });

  revalidatePath("/customers");
  return { ok: true, deleted: existing.length };
}

export async function deleteAllCustomersAction(): Promise<BulkDeleteResult> {
  const actor = await requireAdmin();

  const deleted = await db.transaction(async (tx) => {
    const result = await tx.delete(customers);
    await tx.insert(auditLogs).values({
      actorAgentId: actor.agentId,
      customerId: null,
      action: "bulk_change",
      before: { deletedAllCustomers: false },
      after: { deletedAllCustomers: true, count: result.count },
    });
    return result;
  });

  revalidatePath("/customers");
  revalidatePath("/admin/audit");
  return { ok: true, deleted: deleted.count };
}

// revealRrnAction 제거 — 주민번호는 평문으로 저장·표시되므로 별도 복호화 불필요

type BulkResult =
  | { ok: true; updated: number; newAgentId: string | null }
  | { ok: false; error: string };

export async function bulkReassignAction(
  customerIds: string[],
  targetAgentId: string | null,
): Promise<BulkResult> {
  // 담당자 일괄 재할당은 매니저의 기본 권한. admin 또는 manager 통과.
  const actor = await requireAdminOrManager();
  const validCustomerIds = normalizeUuidList(customerIds, MAX_BULK_CUSTOMERS);
  if (!validCustomerIds) {
    return { ok: false, error: "Invalid customer selection." };
  }

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
    .where(inArray(customers.id, validCustomerIds));

  if (!existing.length) {
    return { ok: false, error: "대상 고객을 찾을 수 없습니다." };
  }

  // 일괄 UPDATE 와 N개 audit INSERT 를 한 트랜잭션으로 — 일부 audit 가 누락되는 것을 방지.
  await db.transaction(async (tx) => {
    await tx
      .update(customers)
      .set({ agentId: newAgent, updatedAt: new Date() })
      .where(inArray(customers.id, validCustomerIds));

    await tx.insert(auditLogs).values(
      existing.map((c) => ({
        actorAgentId: actor.agentId,
        customerId: c.id,
        action: "bulk_change" as const,
        before: { agentId: c.agentId },
        after: { agentId: newAgent },
      })),
    );
  });

  revalidatePath("/customers");
  return { ok: true, updated: existing.length, newAgentId: newAgent };
}

type BulkDateResult =
  | { ok: true; updated: number; newDate: string | null }
  | { ok: false; error: string };

const BULK_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function bulkUpdateDbRegisteredAtAction(
  customerIds: string[],
  newDate: string | null,
): Promise<BulkDateResult> {
  const actor = await requireAdmin();
  const validCustomerIds = normalizeUuidList(customerIds, MAX_BULK_CUSTOMERS);
  if (!validCustomerIds) {
    return { ok: false, error: "Invalid customer selection." };
  }

  const normalized = newDate && newDate.trim() ? newDate.trim() : null;
  if (normalized !== null && !BULK_DATE_RE.test(normalized)) {
    return { ok: false, error: "날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)" };
  }

  const existing = await db
    .select({ id: customers.id, dbRegisteredAt: customers.dbRegisteredAt })
    .from(customers)
    .where(inArray(customers.id, validCustomerIds));

  if (!existing.length) {
    return { ok: false, error: "대상 고객을 찾을 수 없습니다." };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(customers)
      .set({ dbRegisteredAt: normalized, updatedAt: new Date() })
      .where(inArray(customers.id, validCustomerIds));

    await tx.insert(auditLogs).values(
      existing.map((c) => ({
        actorAgentId: actor.agentId,
        customerId: c.id,
        action: "bulk_change" as const,
        before: { dbRegisteredAt: c.dbRegisteredAt },
        after: { dbRegisteredAt: normalized },
      })),
    );
  });

  revalidatePath("/customers");
  return { ok: true, updated: existing.length, newDate: normalized };
}

// fetchCustomerAction 제거 — server action 의 auto-revalidate 부작용으로 URL/cache 가 망가지는 문제가
// 있어 일반 GET API (/api/customers/[id]/context) 로 전환됨.

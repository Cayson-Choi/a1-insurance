"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/rbac";
import { hashPassword } from "@/lib/auth/password";
import {
  CreateUserSchema,
  UpdateUserSchema,
  ResetPasswordSchema,
} from "@/lib/users/schema";

type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function flattenZodErrors(issues: readonly { path: readonly PropertyKey[]; message: string }[]) {
  const out: Record<string, string[]> = {};
  for (const i of issues) {
    const k = i.path.map(String).join(".");
    (out[k] ??= []).push(i.message);
  }
  return out;
}

export async function createUserAction(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const raw = Object.fromEntries(formData.entries());
  const parsed = CreateUserSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "입력값을 확인해주세요.",
      fieldErrors: flattenZodErrors(parsed.error.issues),
    };
  }
  const d = parsed.data;

  const dup = await db.query.users.findFirst({
    where: eq(users.agentId, d.agentId),
  });
  if (dup) {
    return {
      ok: false,
      error: "이미 사용 중인 담당자ID 입니다.",
      fieldErrors: { agentId: ["이미 사용 중"] },
    };
  }

  const passwordHash = await hashPassword(d.password);
  await db.insert(users).values({
    agentId: d.agentId,
    name: d.name,
    role: d.role,
    passwordHash,
    canCreate: d.canCreate,
    canEdit: d.canEdit,
    canDelete: d.canDelete,
    canExport: d.canExport,
  });

  revalidatePath("/admin/users");
  return { ok: true };
}

export async function updateUserAction(
  agentId: string,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireAdmin();

  const raw = Object.fromEntries(formData.entries());
  const parsed = UpdateUserSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "입력값을 확인해주세요.",
      fieldErrors: flattenZodErrors(parsed.error.issues),
    };
  }
  const d = parsed.data;

  const target = await db.query.users.findFirst({ where: eq(users.agentId, agentId) });
  if (!target) return { ok: false, error: "사용자를 찾을 수 없습니다." };

  // 본인의 role을 agent로 바꾸면 즉시 관리자 권한 잃음 → 방지
  if (actor.agentId === agentId && d.role !== "admin") {
    return { ok: false, error: "본인 계정의 관리자 권한은 스스로 해제할 수 없습니다." };
  }

  await db
    .update(users)
    .set({
      name: d.name,
      role: d.role,
      canCreate: d.canCreate,
      canEdit: d.canEdit,
      canDelete: d.canDelete,
      canExport: d.canExport,
    })
    .where(eq(users.agentId, agentId));

  revalidatePath("/admin/users");
  return { ok: true };
}

export async function resetPasswordAction(
  agentId: string,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const raw = Object.fromEntries(formData.entries());
  const parsed = ResetPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "비밀번호를 확인해주세요.",
      fieldErrors: flattenZodErrors(parsed.error.issues),
    };
  }

  const target = await db.query.users.findFirst({ where: eq(users.agentId, agentId) });
  if (!target) return { ok: false, error: "사용자를 찾을 수 없습니다." };

  const passwordHash = await hashPassword(parsed.data.password);
  await db.update(users).set({ passwordHash }).where(eq(users.agentId, agentId));

  revalidatePath("/admin/users");
  return { ok: true };
}

export async function deleteUserAction(agentId: string): Promise<ActionResult> {
  const actor = await requireAdmin();
  if (actor.agentId === agentId) {
    return { ok: false, error: "본인 계정은 삭제할 수 없습니다." };
  }
  const target = await db.query.users.findFirst({ where: eq(users.agentId, agentId) });
  if (!target) return { ok: false, error: "사용자를 찾을 수 없습니다." };

  await db.delete(users).where(eq(users.agentId, agentId));
  // customers.agent_id FK는 ON DELETE SET NULL 이므로 미배정 상태로 전환됨
  revalidatePath("/admin/users");
  revalidatePath("/customers");
  return { ok: true };
}

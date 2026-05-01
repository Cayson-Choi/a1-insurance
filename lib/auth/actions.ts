"use server";

import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { auth, signIn, signOut } from "@/auth";
import { notifyLogout } from "@/lib/notifications";
import type { LogoutReason } from "@/lib/notifications/format";

export type LoginState = {
  error?: string;
  ok?: boolean;
};

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const agentId = String(formData.get("agentId") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/customers");

  if (!agentId || !password) {
    return { error: "담당자ID와 비밀번호를 모두 입력하세요." };
  }

  try {
    await signIn("credentials", {
      agentId,
      password,
      redirectTo: next,
    });
    return { ok: true };
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.type === "CredentialsSignin") {
        return { error: "담당자ID 또는 비밀번호가 올바르지 않습니다." };
      }
      return { error: "로그인 처리 중 문제가 발생했습니다." };
    }
    throw err;
  }
}

// 폼 제출(<form action={logoutAction}>) 은 첫 인자로 FormData 를 넘기므로 union 으로 받는다.
// idle-timeout 은 logoutAction("idle") 로 직접 호출.
export async function logoutAction(arg?: LogoutReason | FormData): Promise<void> {
  const reason: LogoutReason = arg === "idle" ? "idle" : "user";

  // 알림은 signOut 전에 — signOut 은 NEXT_REDIRECT 를 throw 하므로 이후 코드 실행 안 됨.
  // 실패해도 로그아웃은 막지 않는다.
  try {
    const session = await auth();
    if (session?.user?.agentId) {
      const h = await headers();
      const fwd = h.get("x-forwarded-for");
      const ip = fwd ? fwd.split(",")[0]!.trim() : (h.get("x-real-ip") ?? null);
      const ua = h.get("user-agent")?.slice(0, 500) ?? null;
      notifyLogout({
        agentId: session.user.agentId,
        name: session.user.name ?? null,
        role: session.user.role ?? null,
        reason,
        ip,
        userAgent: ua,
        at: new Date(),
      });
    }
  } catch (e) {
    console.warn("[auth] logout notify failed:", e);
  }

  await signOut({ redirectTo: "/login" });
}

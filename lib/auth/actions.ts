"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";

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

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}

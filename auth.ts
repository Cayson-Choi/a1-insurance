import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { headers } from "next/headers";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import authConfig from "./auth.config";
import { db } from "@/lib/db/client";
import { users, loginEvents } from "@/lib/db/schema";
import { notifyLogin } from "@/lib/notifications";

const CredentialsSchema = z.object({
  agentId: z.string().trim().min(1).max(20),
  password: z.string().min(1).max(200),
});

const LAST_SEEN_THROTTLE_MS = 60_000; // 1분마다만 DB 갱신

function getClientIp(h: Headers): string | null {
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? null;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "담당자ID",
      credentials: {
        agentId: { label: "담당자ID", type: "text" },
        password: { label: "비밀번호", type: "password" },
      },
      authorize: async (credentials) => {
        const parsed = CredentialsSchema.safeParse(credentials);
        const h = await headers();
        const ip = getClientIp(h);
        const ua = h.get("user-agent")?.slice(0, 500) ?? null;
        const now = new Date();

        const attemptedAgentId =
          typeof credentials?.agentId === "string"
            ? credentials.agentId.trim().slice(0, 20)
            : "";

        async function recordFailure(reason: string): Promise<null> {
          try {
            await db.insert(loginEvents).values({
              agentId: attemptedAgentId || null,
              success: false,
              ip,
              userAgent: ua,
              reason,
            });
          } catch (e) {
            console.warn("[auth] failed to record login_event:", e);
          }
          notifyLogin({
            agentId: attemptedAgentId,
            name: null,
            role: null,
            success: false,
            ip,
            userAgent: ua,
            reason,
            at: now,
          });
          return null;
        }

        if (!parsed.success) return recordFailure("입력 형식 오류");

        const { agentId, password } = parsed.data;

        const user = await db.query.users.findFirst({
          where: eq(users.agentId, agentId),
        });
        if (!user) return recordFailure("존재하지 않는 ID");

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return recordFailure("비밀번호 불일치");

        await db
          .update(users)
          .set({ lastLoginAt: now, lastSeenAt: now })
          .where(eq(users.agentId, user.agentId));

        try {
          await db.insert(loginEvents).values({
            agentId: user.agentId,
            success: true,
            ip,
            userAgent: ua,
          });
        } catch (e) {
          console.warn("[auth] failed to record login_event:", e);
        }

        notifyLogin({
          agentId: user.agentId,
          name: user.name,
          role: user.role,
          success: true,
          ip,
          userAgent: ua,
          at: now,
        });

        return {
          id: user.id,
          agentId: user.agentId,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.agentId = user.agentId;
        token.role = user.role;
        token.name = user.name;
      }
      // last_seen_at throttled 갱신 — 1분 이상 경과 시만 DB write
      const agentId = token.agentId as string | undefined;
      if (agentId) {
        const lastSeenMs = (token.lastSeenAt as number | undefined) ?? 0;
        const now = Date.now();
        if (now - lastSeenMs > LAST_SEEN_THROTTLE_MS) {
          token.lastSeenAt = now;
          try {
            await db
              .update(users)
              .set({ lastSeenAt: new Date(now) })
              .where(eq(users.agentId, agentId));
          } catch (e) {
            console.warn("[auth] last_seen update failed:", e);
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      const agentId = token.agentId as string | undefined;
      const iat = token.iat as number | undefined;

      // 강제 로그아웃 체크 — sessions_invalidated_at 이 JWT iat 이후면 세션 폐기
      if (agentId && iat) {
        try {
          const row = await db.query.users.findFirst({
            where: eq(users.agentId, agentId),
            columns: { sessionsInvalidatedAt: true },
          });
          if (row?.sessionsInvalidatedAt) {
            const invalidatedAtSec = Math.floor(
              row.sessionsInvalidatedAt.getTime() / 1000,
            );
            if (invalidatedAtSec > iat) {
              // user 를 비우면 getSessionUser() 가 null 반환 → requireUser() 가 /login 리다이렉트
              return { ...session, user: undefined as unknown as typeof session.user };
            }
          }
        } catch (e) {
          console.warn("[auth] invalidation check failed:", e);
        }
      }

      if (token && session.user) {
        session.user.agentId = (token.agentId as string) ?? "";
        session.user.role = (token.role as "admin" | "agent") ?? "agent";
        session.user.name = (token.name as string) ?? session.user.name;
      }
      return session;
    },
  },
});

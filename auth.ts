import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { headers } from "next/headers";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { and, eq, gte, sql } from "drizzle-orm";
import authConfig from "./auth.config";
import { db } from "@/lib/db/client";
import { users, loginEvents } from "@/lib/db/schema";
import { notifyLogin } from "@/lib/notifications";

const CredentialsSchema = z.object({
  agentId: z.string().trim().min(1).max(20),
  password: z.string().min(1).max(200),
});

const LAST_SEEN_THROTTLE_MS = 60_000; // 1분마다만 DB 갱신

// 무차별 대입 방어 — 직전 N분 동안 실패 ≥ THRESHOLD 면 잠금.
// IP 단독, agentId 단독 어느 한쪽이라도 임계 넘으면 차단해 분산 시도(같은 ID 다른 IP)·
// 단일 IP 의 ID enumerate 양쪽 차단.
const LOGIN_LOCKOUT_WINDOW_MS = 10 * 60 * 1000; // 10분
const LOGIN_LOCKOUT_BY_AGENT = 5;
const LOGIN_LOCKOUT_BY_IP = 20;

// timing oracle 균등화용 더미 해시 — 실존 ID 의 평균 bcrypt(12) 비용을 모사.
// 실패하도록 조작된 password+hash 짝.
const DUMMY_BCRYPT_HASH = "$2a$12$CwTycUXWue0Thq9StjUM0uJ8jUMMRMlpRMEQRMlpRMEQRMlpRMEQR";

function getClientIp(h: Headers): string | null {
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? null;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  logger: {
    error(error) {
      // 만료/키 변경된 쿠키에서 발생하는 JWTSessionError 는 비치명적 — 미들웨어가 로그인으로 보내준다.
      // dev overlay 가 잡지 못하도록 조용히 무시.
      if (error?.name === "JWTSessionError" || error?.name === "JWEDecryptionFailed") return;
      console.error(error);
    },
    warn(code) {
      console.warn(`[auth] ${code}`);
    },
    debug() {},
  },
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

        // --- 무차별 대입 잠금 ---
        // login_events 의 최근 실패 집계로 판단 — 별도 캐시 없이 DB 만 사용해 Vercel Functions
        // 인스턴스 재사용 여부와 무관하게 동작.
        try {
          const since = new Date(Date.now() - LOGIN_LOCKOUT_WINDOW_MS);
          const [agentFails, ipFails] = await Promise.all([
            db
              .select({ c: sql<number>`count(*)::int` })
              .from(loginEvents)
              .where(
                and(
                  eq(loginEvents.success, false),
                  eq(loginEvents.agentId, agentId),
                  gte(loginEvents.createdAt, since),
                ),
              ),
            ip
              ? db
                  .select({ c: sql<number>`count(*)::int` })
                  .from(loginEvents)
                  .where(
                    and(
                      eq(loginEvents.success, false),
                      eq(loginEvents.ip, ip),
                      gte(loginEvents.createdAt, since),
                    ),
                  )
              : Promise.resolve([{ c: 0 }]),
          ]);
          const agentCount = agentFails[0]?.c ?? 0;
          const ipCount = ipFails[0]?.c ?? 0;
          if (agentCount >= LOGIN_LOCKOUT_BY_AGENT || ipCount >= LOGIN_LOCKOUT_BY_IP) {
            // 계정 잠금: bcrypt 도 건너뛰지만, recordFailure 가 균등 시간 기여하지 못함 →
            // 잠금 응답 시간 차이가 enumerate 단서가 될 수 있어 더미 bcrypt 한 번 돌려 균등화.
            await bcrypt.compare(password, DUMMY_BCRYPT_HASH);
            return recordFailure("계정 잠금 — 일시적 차단");
          }
        } catch (e) {
          // 잠금 판정 실패 시 fail-open 하되 경고 로깅 — 인증 자체는 막지 않음.
          console.warn("[auth] lockout check failed:", e);
        }

        const user = await db.query.users.findFirst({
          where: eq(users.agentId, agentId),
        });

        // 사용자 존재 여부에 따른 응답시간 차이(timing oracle) 차단 —
        // 미존재 시에도 dummy bcrypt 한 번 돌려 평균 시간 균등화.
        if (!user) {
          await bcrypt.compare(password, DUMMY_BCRYPT_HASH);
          return recordFailure("존재하지 않는 ID");
        }

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

      // 강제 로그아웃 체크 — sessions_invalidated_at 이 JWT iat 이후면 세션 폐기.
      // DB 장애 시 fail-closed: 강제 로그아웃이 무력화되는 윈도우를 만들지 않기 위해
      // 조회 실패 시 세션을 비워 /login 으로 보낸다.
      if (agentId && iat) {
        try {
          const row = await db.query.users.findFirst({
            where: eq(users.agentId, agentId),
            columns: { sessionsInvalidatedAt: true },
          });
          if (!row) {
            return { ...session, user: undefined as unknown as typeof session.user };
          }
          if (row.sessionsInvalidatedAt) {
            const invalidatedAtSec = Math.floor(
              row.sessionsInvalidatedAt.getTime() / 1000,
            );
            if (invalidatedAtSec > iat) {
              return { ...session, user: undefined as unknown as typeof session.user };
            }
          }
        } catch (e) {
          console.warn("[auth] invalidation check failed (fail-closed):", e);
          return { ...session, user: undefined as unknown as typeof session.user };
        }
      }

      if (token && session.user) {
        session.user.agentId = (token.agentId as string) ?? "";
        session.user.role = (token.role as "admin" | "manager" | "agent") ?? "agent";
        session.user.name = (token.name as string) ?? session.user.name;
      }
      return session;
    },
  },
});

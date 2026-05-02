import { z } from "zod";

const EnvSchema = z.object({
  DATABASE_URL: z.string().url().min(1),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 chars"),
  // 주민번호 암호화 + 검색용 HMAC 키. 실제 사용 시 값이 없으면 lib/security/pii.ts 에서 fail-closed.
  PII_ENC_KEY: z.string().regex(/^[0-9a-f]{64}$/i, "PII_ENC_KEY must be 32-byte hex").optional(),
  PII_HMAC_KEY: z.string().regex(/^[0-9a-f]{64}$/i, "PII_HMAC_KEY must be 32-byte hex").optional(),
  // 로그인 알림용 Slack Incoming Webhook URL (선택)
  SLACK_WEBHOOK_URL: z.string().url().optional(),
  // 로그인 알림용 Telegram Bot (선택) — 둘 다 설정돼야 동작
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

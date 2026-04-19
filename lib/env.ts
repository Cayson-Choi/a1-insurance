import { z } from "zod";

const EnvSchema = z.object({
  DATABASE_URL: z.string().url().min(1),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 chars"),
  // 레거시 변수 — 주민번호 평문 저장으로 더 이상 사용하지 않지만 기존 배포 호환 위해 optional 유지
  PII_ENC_KEY: z.string().optional(),
  PII_HMAC_KEY: z.string().optional(),
  // 로그인 알림용 Slack Incoming Webhook URL (선택)
  SLACK_WEBHOOK_URL: z.string().url().optional(),
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

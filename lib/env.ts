import { z } from "zod";

const EnvSchema = z.object({
  DATABASE_URL: z.string().url().min(1),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 chars"),
  PII_ENC_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, "PII_ENC_KEY must be 32-byte hex (64 chars)"),
  PII_HMAC_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, "PII_HMAC_KEY must be 32-byte hex (64 chars)"),
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

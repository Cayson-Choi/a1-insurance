import { z } from "zod";

const AgentIdSchema = z
  .string()
  .trim()
  .min(2, "담당자ID는 2자 이상 입력하세요.")
  .max(20, "담당자ID는 20자 이하로 입력하세요.")
  .regex(/^[a-zA-Z0-9_-]+$/, "영문·숫자·_·- 만 사용 가능합니다.");

// 자주 쓰이는 패턴 차단 — 사전 공격에 가장 빨리 뚫리는 후보.
const COMMON_WEAK = new Set([
  "password",
  "admin",
  "12345678",
  "123456789",
  "1234567890",
  "qwerty123",
  "aone1234",
  "aone2024",
  "aone2025",
  "aone2026",
  "dbcrm1234",
  "dbcrm2025",
  "dbcrm2026",
]);

const PasswordSchema = z
  .string()
  .min(10, "비밀번호는 10자 이상 입력하세요.")
  .max(200)
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), {
    message: "영문과 숫자를 모두 포함하세요.",
  })
  .refine((v) => !/^(.)\1+$/.test(v), {
    message: "한 글자 반복은 허용되지 않습니다.",
  })
  .refine((v) => !COMMON_WEAK.has(v.toLowerCase()), {
    message: "추측하기 쉬운 비밀번호입니다. 다른 비밀번호를 사용하세요.",
  });

const boolFlag = z
  .any()
  .transform((v) => v === true || v === "true" || v === "on" || v === "1");

export const CreateUserSchema = z.object({
  agentId: AgentIdSchema,
  name: z.string().trim().min(1, "이름을 입력하세요.").max(60),
  role: z.enum(["admin", "manager", "agent"]),
  password: PasswordSchema,
  canCreate: boolFlag,
  canEdit: boolFlag,
  canDelete: boolFlag,
  canExport: boolFlag,
  canDownloadImage: boolFlag,
});

export const UpdateUserSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력하세요.").max(60),
  role: z.enum(["admin", "manager", "agent"]),
  canCreate: boolFlag,
  canEdit: boolFlag,
  canDelete: boolFlag,
  canExport: boolFlag,
  canDownloadImage: boolFlag,
});

export const ResetPasswordSchema = z.object({
  password: PasswordSchema,
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

import { z } from "zod";

const optionalString = z
  .string()
  .trim()
  .max(60)
  .optional()
  .transform((v) => (v === "" || v === undefined ? null : v));

const AgentIdSchema = z
  .string()
  .trim()
  .min(2, "담당자ID는 2자 이상 입력하세요.")
  .max(20, "담당자ID는 20자 이하로 입력하세요.")
  .regex(/^[a-zA-Z0-9_-]+$/, "영문·숫자·_·- 만 사용 가능합니다.");

const PasswordSchema = z
  .string()
  .min(6, "비밀번호는 6자 이상 입력하세요.")
  .max(200);

export const CreateUserSchema = z.object({
  agentId: AgentIdSchema,
  name: z.string().trim().min(1, "이름을 입력하세요.").max(60),
  role: z.enum(["admin", "agent"]),
  password: PasswordSchema,
  branch: optionalString,
  hq: optionalString,
  team: optionalString,
});

export const UpdateUserSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력하세요.").max(60),
  role: z.enum(["admin", "agent"]),
  branch: optionalString,
  hq: optionalString,
  team: optionalString,
});

export const ResetPasswordSchema = z.object({
  password: PasswordSchema,
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

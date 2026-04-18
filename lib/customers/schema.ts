import { z } from "zod";
import { CALL_RESULTS } from "@/lib/excel/column-map";

const optionalString = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => (v === "" || v === undefined ? null : v));

const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" || v === undefined ? null : v))
  .refine(
    (v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v),
    { message: "YYYY-MM-DD 형식으로 입력해주세요." },
  );

const optionalDateTime = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" || v === undefined ? null : v))
  .refine(
    (v) => v === null || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v),
    { message: "YYYY-MM-DDTHH:MM 형식으로 입력해주세요." },
  );

const optionalPhone = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" || v === undefined ? null : v))
  .refine(
    (v) => v === null || /^[\d\-\s()+]+$/.test(v),
    { message: "숫자·하이픈만 입력 가능합니다." },
  );

const optionalRrnFront = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" || v === undefined ? null : v.replace(/\D/g, "")))
  .refine((v) => v === null || /^\d{6}$/.test(v), {
    message: "주민번호 앞자리는 숫자 6자리 입니다.",
  });

const optionalRrnBack = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" || v === undefined ? null : v.replace(/\D/g, "")))
  .refine((v) => v === null || /^\d{7}$/.test(v), {
    message: "주민번호 뒷자리는 숫자 7자리 입니다.",
  });

export const UpdateCustomerSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력하세요.").max(60),
  phone1: optionalPhone,
  job: optionalString,
  address: optionalString,
  addressDetail: optionalString,
  callResult: z.enum(CALL_RESULTS).nullable().optional(),
  dbCompany: optionalString,
  dbProduct: optionalString,
  dbStartAt: optionalDate,
  reservationAt: optionalDateTime,
  memo: optionalString,
  rrnFront: optionalRrnFront,
  rrnBack: optionalRrnBack,
  agentId: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
});

export type UpdateCustomerInput = z.infer<typeof UpdateCustomerSchema>;

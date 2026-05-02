-- 사용자 관리·보안 이벤트(import 일괄변경 포함) 추적용 audit_action 값 추가.
-- ALTER TYPE ... ADD VALUE 는 PG 12+ 에서 트랜잭션 내 사용 가능 — 같은 트랜잭션에서
-- 새 값을 즉시 사용하지 않으므로 안전.

ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'user_create';
ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'user_update';
ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'user_delete';
ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'password_reset';
ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'force_logout';
ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'import';

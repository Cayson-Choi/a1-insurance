-- 역할 계층에 "manager" 추가.
-- admin 과 agent 사이의 중간 계급으로,
-- (1) 전체 담당자의 고객 조회, (2) 담당자 재할당(개별+일괄), (3) agent 와 동일한 플래그-based 권한 를 가진다.
-- 관리자 전용 페이지(users/excel/audit/logins)는 여전히 admin 만 접근 가능.

ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'manager';

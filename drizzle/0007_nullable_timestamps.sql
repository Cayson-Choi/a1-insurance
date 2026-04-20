-- 엑셀 업로드 시 "빈 셀은 빈 값으로 유지" 정책을 위해
-- customers.created_at / updated_at 의 NOT NULL 제약 해제.
-- 엑셀의 등록일·수정일 셀이 비어있으면 DB에도 NULL 로 저장됨.

ALTER TABLE "customers" ALTER COLUMN "created_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ALTER COLUMN "updated_at" DROP NOT NULL;

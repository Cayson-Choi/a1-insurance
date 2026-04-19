-- 주민번호 평문 저장으로 전환 (암호화·해시 제거)
ALTER TABLE "customers" ADD COLUMN "rrn_front" varchar(6);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "rrn_back" varchar(7);--> statement-breakpoint

-- 인덱스 변경
DROP INDEX IF EXISTS "customers_rrn_front_hash_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "customers_rrn_back_hash_idx";--> statement-breakpoint
CREATE INDEX "customers_rrn_front_idx" ON "customers" USING btree ("rrn_front");--> statement-breakpoint
CREATE INDEX "customers_rrn_back_idx" ON "customers" USING btree ("rrn_back");--> statement-breakpoint

-- 기존 암호화·해시 컬럼 제거
ALTER TABLE "customers" DROP COLUMN "rrn_front_hash";--> statement-breakpoint
ALTER TABLE "customers" DROP COLUMN "rrn_back_enc";--> statement-breakpoint
ALTER TABLE "customers" DROP COLUMN "rrn_back_hash";

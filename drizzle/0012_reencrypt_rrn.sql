ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "rrn_front_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "rrn_back_enc" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "rrn_back_hash" varchar(64);--> statement-breakpoint

DROP INDEX IF EXISTS "customers_rrn_front_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "customers_rrn_back_idx";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customers_rrn_front_hash_idx" ON "customers" USING btree ("rrn_front_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customers_rrn_back_hash_idx" ON "customers" USING btree ("rrn_back_hash");

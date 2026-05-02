CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "customers_default_sort_idx"
  ON "customers" ("db_registered_at" DESC, "created_at" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customers_agent_default_sort_idx"
  ON "customers" ("agent_id", "db_registered_at" DESC, "created_at" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customers_agent_name_sort_idx"
  ON "customers" ("agent_id", "name", "created_at" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customers_birth_created_idx"
  ON "customers" ("birth_date", "created_at" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customers_updated_created_idx"
  ON "customers" ("updated_at" DESC, "created_at" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customers_name_trgm_idx"
  ON "customers" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customers_address_trgm_idx"
  ON "customers" USING gin ("address" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customers_phone_digits_trgm_idx"
  ON "customers" USING gin ((regexp_replace(coalesce("phone1", ''), '[^0-9]', '', 'g')) gin_trgm_ops);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "audit_logs_created_idx"
  ON "audit_logs" ("created_at" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_actor_created_idx"
  ON "audit_logs" ("actor_agent_id", "created_at" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_action_created_idx"
  ON "audit_logs" ("action", "created_at" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_customer_idx"
  ON "audit_logs" ("customer_id");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "login_events_success_created_idx"
  ON "login_events" ("success", "created_at" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "login_events_ip_created_idx"
  ON "login_events" ("ip", "created_at" DESC);

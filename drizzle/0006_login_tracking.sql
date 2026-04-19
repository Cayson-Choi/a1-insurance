-- users: 강제 로그아웃 + 접속 상태 판정용
ALTER TABLE "users" ADD COLUMN "sessions_invalidated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_seen_at" timestamp with time zone;--> statement-breakpoint

-- login_events: 성공·실패 모두 기록
CREATE TABLE IF NOT EXISTS "login_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "agent_id" varchar(20),
  "success" boolean NOT NULL,
  "ip" varchar(45),
  "user_agent" varchar(500),
  "reason" varchar(100),
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "login_events_agent_idx" ON "login_events" USING btree ("agent_id", "created_at" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "login_events_created_idx" ON "login_events" USING btree ("created_at" DESC);

CREATE TYPE "public"."audit_action" AS ENUM('agent_change', 'bulk_change', 'edit', 'rrn_decrypt');--> statement-breakpoint
CREATE TYPE "public"."call_result" AS ENUM('예약', '부재', '가망', '거절', '결번', '민원');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'agent');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_agent_id" varchar(20) NOT NULL,
	"customer_id" uuid,
	"action" "audit_action" NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_code" varchar(32),
	"agent_id" varchar(20),
	"name" varchar(60) NOT NULL,
	"birth_date" date,
	"rrn_front_hash" varchar(64),
	"rrn_back_enc" "bytea",
	"rrn_back_hash" varchar(64),
	"phone1" varchar(30),
	"job" text,
	"address" text,
	"address_detail" text,
	"call_result" "call_result",
	"db_product" text,
	"db_premium" numeric(14, 2),
	"db_handler" varchar(60),
	"sub_category" varchar(60),
	"db_policy_no" varchar(60),
	"db_registered_at" date,
	"main_category" varchar(60),
	"db_start_at" date,
	"db_end_at" date,
	"branch" varchar(60),
	"hq" varchar(60),
	"team" varchar(60),
	"fax" varchar(30),
	"reservation_received" date,
	"reservation_at" timestamp with time zone,
	"memo" text,
	"db_company" varchar(60),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_customer_code_unique" UNIQUE("customer_code")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" varchar(20) NOT NULL,
	"password_hash" text NOT NULL,
	"name" varchar(60) NOT NULL,
	"role" "user_role" DEFAULT 'agent' NOT NULL,
	"branch" varchar(60),
	"hq" varchar(60),
	"team" varchar(60),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "users_agent_id_unique" UNIQUE("agent_id")
);
--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_agent_id_users_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("agent_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customers_agent_id_idx" ON "customers" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "customers_name_idx" ON "customers" USING btree ("name");--> statement-breakpoint
CREATE INDEX "customers_rrn_front_hash_idx" ON "customers" USING btree ("rrn_front_hash");--> statement-breakpoint
CREATE INDEX "customers_rrn_back_hash_idx" ON "customers" USING btree ("rrn_back_hash");--> statement-breakpoint
CREATE INDEX "customers_db_registered_idx" ON "customers" USING btree ("db_registered_at");--> statement-breakpoint
CREATE INDEX "customers_call_result_idx" ON "customers" USING btree ("call_result");--> statement-breakpoint
CREATE UNIQUE INDEX "users_agent_id_uq" ON "users" USING btree ("agent_id");
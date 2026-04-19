ALTER TABLE "users" ADD COLUMN "can_create" boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "can_edit" boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "can_delete" boolean NOT NULL DEFAULT false;--> statement-breakpoint
UPDATE "users" SET "can_create" = "can_manage", "can_edit" = "can_manage", "can_delete" = "can_manage";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "can_manage";

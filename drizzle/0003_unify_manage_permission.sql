ALTER TABLE "users" ADD COLUMN "can_manage" boolean NOT NULL DEFAULT false;--> statement-breakpoint
UPDATE "users" SET "can_manage" = ("can_create" OR "can_edit" OR "can_delete");--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "can_create";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "can_edit";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "can_delete";

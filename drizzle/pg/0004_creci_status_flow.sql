ALTER TABLE "users" ADD COLUMN "creciStatus" varchar(20);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "creciVerifiedAt" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "creciVerifiedByUserId" integer;
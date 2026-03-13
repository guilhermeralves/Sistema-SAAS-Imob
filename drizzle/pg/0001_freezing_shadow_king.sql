CREATE TABLE "adminUserViews" (
	"id" serial PRIMARY KEY NOT NULL,
	"adminUserId" integer NOT NULL,
	"viewedUserId" integer NOT NULL,
	"viewedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "registrationSource" varchar(32) DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "adminUserViews_adminUserId_viewedUserId_idx" ON "adminUserViews" USING btree ("adminUserId","viewedUserId");
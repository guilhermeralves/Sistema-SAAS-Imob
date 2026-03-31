ALTER TABLE "taskItems"
ADD COLUMN "sector" varchar(40) DEFAULT 'administrativo' NOT NULL;
--> statement-breakpoint
CREATE TABLE "taskItemTemplates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"kind" varchar(20) NOT NULL,
	"sector" varchar(40) NOT NULL,
	"defaultTitle" varchar(180) NOT NULL,
	"defaultDescription" text,
	"createdByUserId" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER taskItemTemplates_set_updated_at
BEFORE UPDATE ON "taskItemTemplates"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

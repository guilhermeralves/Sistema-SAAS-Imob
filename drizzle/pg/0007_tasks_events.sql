CREATE TABLE "taskItems" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(180) NOT NULL,
	"kind" varchar(20) DEFAULT 'tarefa' NOT NULL,
	"status" varchar(20) DEFAULT 'pendente' NOT NULL,
	"dueAt" timestamp,
	"description" text,
	"createdByUserId" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "taskItemAssignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"taskId" integer NOT NULL,
	"userId" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "taskItemNotes" (
	"id" serial PRIMARY KEY NOT NULL,
	"taskId" integer NOT NULL,
	"userId" integer NOT NULL,
	"note" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "taskItemAssignments_taskId_userId_idx" ON "taskItemAssignments" USING btree ("taskId","userId");
--> statement-breakpoint
CREATE TRIGGER taskItems_set_updated_at
BEFORE UPDATE ON "taskItems"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE "leadInteractions" (
	"id" serial PRIMARY KEY NOT NULL,
	"idLead" integer NOT NULL,
	"idUsuario" integer,
	"eventType" varchar(80) NOT NULL,
	"message" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "assignmentCycleStartedAt" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "assignedAt" timestamp;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "attendedAt" timestamp;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "assignmentSlaNotifiedAt" timestamp;
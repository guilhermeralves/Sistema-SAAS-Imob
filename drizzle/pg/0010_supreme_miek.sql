CREATE TABLE "propertyKeyStatusRequests" (
	"id" serial PRIMARY KEY NOT NULL,
	"idImovel" integer NOT NULL,
	"requestedByUserId" integer NOT NULL,
	"requestedStatus" varchar(20) NOT NULL,
	"requestedObservation" text NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"reviewedByUserId" integer,
	"reviewNote" text,
	"reviewedAt" timestamp,
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
CREATE TABLE "taskItems" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(180) NOT NULL,
	"kind" varchar(20) DEFAULT 'tarefa' NOT NULL,
	"sector" varchar(40) DEFAULT 'administrativo' NOT NULL,
	"status" varchar(20) DEFAULT 'pendente' NOT NULL,
	"dueAt" timestamp,
	"description" text,
	"createdByUserId" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "properties" ALTER COLUMN "idProprietario" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "keyStatus" varchar(20) DEFAULT 'disponivel' NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "keyStatusObservation" text DEFAULT 'Chaves disponíveis na imobiliária.' NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "keyStatusUpdatedByUserId" integer;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "keyStatusUpdatedAt" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "taskItemAssignments_taskId_userId_idx" ON "taskItemAssignments" USING btree ("taskId","userId");
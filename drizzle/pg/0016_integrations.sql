CREATE TABLE IF NOT EXISTS "integrations" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" varchar(140) NOT NULL,
  "category" varchar(40) NOT NULL,
  "provider" varchar(120) NOT NULL,
  "connectionType" varchar(30) NOT NULL,
  "status" varchar(20) DEFAULT 'rascunho' NOT NULL,
  "endpoint" text,
  "apiKey" text,
  "configJson" text,
  "notes" text,
  "lastTestedAt" timestamp,
  "lastError" text,
  "createdByUserId" integer NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

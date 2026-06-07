CREATE TABLE IF NOT EXISTS "rentalProposalGeneratedContracts" (
  "id" serial PRIMARY KEY NOT NULL,
  "rentalProposalId" integer NOT NULL,
  "contractTemplateId" integer NOT NULL,
  "status" varchar(40) DEFAULT 'em_revisao' NOT NULL,
  "title" varchar(180) NOT NULL,
  "generatedText" text NOT NULL,
  "reviewedText" text NOT NULL,
  "variableValues" text DEFAULT '{}' NOT NULL,
  "unresolvedVariables" text DEFAULT '[]' NOT NULL,
  "generatedAt" timestamp DEFAULT now() NOT NULL,
  "approvedAt" timestamp,
  "approvedByUserId" integer,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "rentalProposalGeneratedContracts_unique_idx"
ON "rentalProposalGeneratedContracts" USING btree ("rentalProposalId","contractTemplateId");

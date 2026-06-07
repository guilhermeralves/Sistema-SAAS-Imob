CREATE TABLE IF NOT EXISTS "rentalProposalContractTemplates" (
  "id" serial PRIMARY KEY NOT NULL,
  "rentalProposalId" integer NOT NULL,
  "contractTemplateId" integer NOT NULL,
  "position" integer DEFAULT 1 NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "rentalProposalContractTemplates_unique_idx"
ON "rentalProposalContractTemplates" USING btree ("rentalProposalId","contractTemplateId");

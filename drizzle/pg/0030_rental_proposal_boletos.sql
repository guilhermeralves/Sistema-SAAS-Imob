CREATE TABLE IF NOT EXISTS "rentalProposalBoletos" (
  "id" serial PRIMARY KEY NOT NULL,
  "rentalProposalId" integer NOT NULL,
  "installmentNumber" integer NOT NULL,
  "referenceMonth" date NOT NULL,
  "dueDate" date NOT NULL,
  "rentAmount" integer NOT NULL,
  "condominiumAmount" integer,
  "extraAmount" integer DEFAULT 0 NOT NULL,
  "extraDescription" varchar(180),
  "totalAmount" integer NOT NULL,
  "status" varchar(20) DEFAULT 'pendente' NOT NULL,
  "notes" text,
  "approvedAt" timestamp,
  "approvedByUserId" integer,
  "paidAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "rentalProposalBoletos_unique_idx"
ON "rentalProposalBoletos" USING btree ("rentalProposalId","installmentNumber");

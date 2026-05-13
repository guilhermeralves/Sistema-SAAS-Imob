ALTER TABLE "rentalProposals"
ADD COLUMN IF NOT EXISTS "condominiumAmount" integer;

CREATE TABLE IF NOT EXISTS "rentalProposalTenants" (
  "id" serial PRIMARY KEY NOT NULL,
  "rentalProposalId" integer NOT NULL,
  "tenantUserId" integer NOT NULL,
  "position" integer DEFAULT 1 NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "rentalProposalTenants_unique_idx"
ON "rentalProposalTenants" USING btree ("rentalProposalId","tenantUserId");

CREATE TABLE IF NOT EXISTS "rentalProposalOwners" (
  "id" serial PRIMARY KEY NOT NULL,
  "rentalProposalId" integer NOT NULL,
  "ownerId" integer NOT NULL,
  "position" integer DEFAULT 1 NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "rentalProposalOwners_unique_idx"
ON "rentalProposalOwners" USING btree ("rentalProposalId","ownerId");

INSERT INTO "rentalProposalTenants" ("rentalProposalId", "tenantUserId", "position")
SELECT "id", "tenantUserId", 1
FROM "rentalProposals"
ON CONFLICT DO NOTHING;

INSERT INTO "rentalProposalOwners" ("rentalProposalId", "ownerId", "position")
SELECT "id", "ownerId", 1
FROM "rentalProposals"
WHERE "ownerId" IS NOT NULL
ON CONFLICT DO NOTHING;

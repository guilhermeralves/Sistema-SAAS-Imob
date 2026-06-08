ALTER TABLE "rentalProposals" ADD COLUMN IF NOT EXISTS "adjustmentPeriod" varchar(20);
ALTER TABLE "rentalProposals" ADD COLUMN IF NOT EXISTS "administrationFeePercent" integer;
ALTER TABLE "rentalProposals" ADD COLUMN IF NOT EXISTS "transferBusinessDays" integer;
ALTER TABLE "rentalProposals" ADD COLUMN IF NOT EXISTS "terminationPenaltyType" varchar(20);
ALTER TABLE "rentalProposals" ADD COLUMN IF NOT EXISTS "terminationPenaltyAmount" integer;

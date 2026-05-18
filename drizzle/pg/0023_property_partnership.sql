ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "parceria" integer DEFAULT 0 NOT NULL;
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "parceriaNome" varchar(160);
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "parceriaTelefone" varchar(20);
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "parceriaReferencia" varchar(120);

ALTER TABLE "contractTemplates"
ADD COLUMN IF NOT EXISTS "contractKind" varchar(30);

UPDATE "contractTemplates"
SET "contractKind" = 'locacao'
WHERE "contractKind" IS NULL;

ALTER TABLE "contractTemplates"
ALTER COLUMN "contractKind" SET DEFAULT 'locacao';

ALTER TABLE "contractTemplates"
ALTER COLUMN "contractKind" SET NOT NULL;

ALTER TABLE "contractTemplates"
ADD COLUMN IF NOT EXISTS "participantRoles" text;

UPDATE "contractTemplates"
SET "participantRoles" = '["locatario","proprietario","corretor","imovel","locacao"]'
WHERE "participantRoles" IS NULL OR "participantRoles" = '';

ALTER TABLE "contractTemplates"
ALTER COLUMN "participantRoles" SET DEFAULT '["locatario","proprietario","corretor","imovel","locacao"]';

ALTER TABLE "contractTemplates"
ALTER COLUMN "participantRoles" SET NOT NULL;

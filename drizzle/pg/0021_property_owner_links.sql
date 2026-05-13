CREATE TABLE IF NOT EXISTS "propertyOwnerLinks" (
  "id" serial PRIMARY KEY NOT NULL,
  "propertyId" integer NOT NULL,
  "ownerId" integer NOT NULL,
  "position" integer DEFAULT 1 NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "propertyOwnerLinks_unique_idx"
ON "propertyOwnerLinks" USING btree ("propertyId","ownerId");

INSERT INTO "propertyOwnerLinks" ("propertyId", "ownerId", "position")
SELECT "id", "idProprietario", 1
FROM "properties"
WHERE "idProprietario" IS NOT NULL
ON CONFLICT DO NOTHING;

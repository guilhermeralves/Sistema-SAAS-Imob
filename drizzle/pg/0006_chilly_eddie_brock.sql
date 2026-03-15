CREATE TABLE "propertyOwners" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer,
	"name" varchar(120) NOT NULL,
	"email" varchar(255) NOT NULL,
	"cpf" varchar(14) NOT NULL,
	"phone" varchar(20) NOT NULL,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "idProprietario" integer;
--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "createdByUserId" integer;
--> statement-breakpoint
UPDATE "properties"
SET "createdByUserId" = "idCorretor"
WHERE "createdByUserId" IS NULL;
--> statement-breakpoint
ALTER TABLE "properties" ALTER COLUMN "createdByUserId" SET NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "propertyOwners_cpf_idx" ON "propertyOwners" USING btree ("cpf");
--> statement-breakpoint
CREATE TRIGGER property_owners_set_updated_at
BEFORE UPDATE ON "propertyOwners"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

ALTER TABLE "properties"
ADD COLUMN "keyStatus" varchar(20) DEFAULT 'disponivel' NOT NULL;
--> statement-breakpoint
ALTER TABLE "properties"
ADD COLUMN "keyStatusObservation" text DEFAULT 'Chaves disponiveis na imobiliaria.' NOT NULL;
--> statement-breakpoint
ALTER TABLE "properties"
ADD COLUMN "keyStatusUpdatedByUserId" integer;
--> statement-breakpoint
ALTER TABLE "properties"
ADD COLUMN "keyStatusUpdatedAt" timestamp DEFAULT now() NOT NULL;
--> statement-breakpoint
CREATE TABLE "propertyKeyStatusRequests" (
	"id" serial PRIMARY KEY NOT NULL,
	"idImovel" integer NOT NULL,
	"requestedByUserId" integer NOT NULL,
	"requestedStatus" varchar(20) NOT NULL,
	"requestedObservation" text NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"reviewedByUserId" integer,
	"reviewNote" text,
	"reviewedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "propertyKeyStatusRequests_idImovel_idx"
ON "propertyKeyStatusRequests" USING btree ("idImovel");
--> statement-breakpoint
CREATE INDEX "propertyKeyStatusRequests_status_idx"
ON "propertyKeyStatusRequests" USING btree ("status");
--> statement-breakpoint
CREATE TRIGGER property_key_status_requests_set_updated_at
BEFORE UPDATE ON "propertyKeyStatusRequests"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

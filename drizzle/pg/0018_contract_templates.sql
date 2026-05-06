CREATE TABLE "contractTemplates" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" varchar(180) NOT NULL,
  "notes" text,
  "originalFileName" varchar(255) NOT NULL,
  "originalMimeType" varchar(120) NOT NULL,
  "originalFileData" text NOT NULL,
  "extractedText" text NOT NULL,
  "reviewedText" text NOT NULL,
  "variableHighlights" text DEFAULT '[]' NOT NULL,
  "createdByUserId" integer NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TRIGGER contract_templates_set_updated_at
BEFORE UPDATE ON "contractTemplates"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

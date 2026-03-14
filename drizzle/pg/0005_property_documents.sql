CREATE TABLE "propertyDocuments" (
  "id" serial PRIMARY KEY NOT NULL,
  "idImovel" integer NOT NULL,
  "idUsuario" integer NOT NULL,
  "nomeArquivo" varchar(255) NOT NULL,
  "urlArquivo" text NOT NULL,
  "tipoArquivo" varchar(120) NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER property_documents_set_updated_at
BEFORE UPDATE ON "propertyDocuments"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

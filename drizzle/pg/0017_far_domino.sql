CREATE TABLE "condominios" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" varchar(180) NOT NULL,
	"tipo" varchar(20) NOT NULL,
	"endereco" varchar(255) NOT NULL,
	"numero" varchar(20),
	"complemento" varchar(120),
	"bairro" varchar(100),
	"cidade" varchar(100) NOT NULL,
	"estado" varchar(2) NOT NULL,
	"cep" varchar(10),
	"referencia" text,
	"valorCondominio" integer,
	"valorIptu" integer,
	"cnpj" varchar(18),
	"administradoraNome" varchar(120),
	"administradoraContato" varchar(120),
	"caracteristicas" text,
	"observacoes" text,
	"isAtivo" integer DEFAULT 1 NOT NULL,
	"createdByUserId" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(140) NOT NULL,
	"category" varchar(40) NOT NULL,
	"provider" varchar(120) NOT NULL,
	"connectionType" varchar(30) NOT NULL,
	"status" varchar(20) DEFAULT 'rascunho' NOT NULL,
	"endpoint" text,
	"apiKey" text,
	"configJson" text,
	"notes" text,
	"lastTestedAt" timestamp,
	"lastError" text,
	"createdByUserId" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "emCondominio" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "tipoCondominio" varchar(20);--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "idCondominio" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "condominios_nome_cidade_idx" ON "condominios" USING btree ("nome","cidade");
CREATE TABLE "contracts" (
	"id" serial PRIMARY KEY NOT NULL,
	"idCliente" integer NOT NULL,
	"idImovel" integer NOT NULL,
	"tipo" varchar(20) NOT NULL,
	"valor" integer NOT NULL,
	"dataInicio" timestamp NOT NULL,
	"dataFim" timestamp,
	"status" varchar(20) DEFAULT 'ativo' NOT NULL,
	"urlContrato" varchar(500),
	"observacoes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"idUsuario" integer NOT NULL,
	"nomeArquivo" varchar(255) NOT NULL,
	"urlArquivo" varchar(500) NOT NULL,
	"tipo" varchar(100) NOT NULL,
	"status" varchar(20) DEFAULT 'pendente' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leadFiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"idLead" integer NOT NULL,
	"idUsuario" integer NOT NULL,
	"nomeArquivo" varchar(255) NOT NULL,
	"urlArquivo" varchar(500) NOT NULL,
	"tipoArquivo" varchar(100),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leadNotes" (
	"id" serial PRIMARY KEY NOT NULL,
	"idLead" integer NOT NULL,
	"idUsuario" integer NOT NULL,
	"anotacao" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" varchar(255) NOT NULL,
	"email" varchar(320),
	"telefone" varchar(20),
	"origem" varchar(100),
	"interesse" text,
	"observacao" text,
	"status" varchar(50) DEFAULT 'novo' NOT NULL,
	"idResponsavel" integer,
	"idImovel" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" serial PRIMARY KEY NOT NULL,
	"titulo" varchar(255) NOT NULL,
	"descricao" text,
	"tipo" varchar(50) NOT NULL,
	"finalidade" varchar(20) NOT NULL,
	"valor" integer NOT NULL,
	"valorLocacao" integer,
	"area" integer,
	"quartos" integer,
	"banheiros" integer,
	"vagas" integer,
	"endereco" varchar(255) NOT NULL,
	"numero" varchar(20),
	"bairro" varchar(100),
	"cidade" varchar(100) NOT NULL,
	"estado" varchar(2) NOT NULL,
	"cep" varchar(10),
	"latitude" varchar(20),
	"longitude" varchar(20),
	"fotos" text,
	"destaque" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'ativo' NOT NULL,
	"idCorretor" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"cpf" varchar(14),
	"phone" varchar(20),
	"birthDate" date,
	"profession" varchar(120),
	"grossMonthlyIncome" integer,
	"maritalStatus" varchar(40),
	"householdIncome" integer,
	"rg" varchar(32),
	"nationality" varchar(80),
	"address" varchar(255),
	"neighborhood" varchar(100),
	"addressNumber" varchar(20),
	"city" varchar(100),
	"state" varchar(2),
	"zipCode" varchar(10),
	"notes" text,
	"loginMethod" varchar(64),
	"passwordHash" varchar(255),
	"registrationSource" varchar(32) DEFAULT 'legacy' NOT NULL,
	"role" varchar(20) DEFAULT 'cliente' NOT NULL,
	"isActive" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId"),
	CONSTRAINT "users_cpf_unique" UNIQUE("cpf")
);
--> statement-breakpoint
CREATE TABLE "adminUserViews" (
	"id" serial PRIMARY KEY NOT NULL,
	"adminUserId" integer NOT NULL,
	"viewedUserId" integer NOT NULL,
	"viewedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "adminUserViews_adminUserId_viewedUserId_idx" ON "adminUserViews" USING btree ("adminUserId","viewedUserId");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
	NEW."updatedAt" = now();
	RETURN NEW;
END;
$$ language 'plpgsql';
--> statement-breakpoint
CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON "users"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER properties_set_updated_at
BEFORE UPDATE ON "properties"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER leads_set_updated_at
BEFORE UPDATE ON "leads"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER contracts_set_updated_at
BEFORE UPDATE ON "contracts"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER documents_set_updated_at
BEFORE UPDATE ON "documents"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

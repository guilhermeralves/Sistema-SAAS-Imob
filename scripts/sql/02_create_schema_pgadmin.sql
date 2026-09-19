-- Execute este arquivo no pgAdmin ja conectado ao banco "afg_imobiliaria".
-- Este script cria a estrutura atual esperada pelo projeto Sistema-SAAS-Imob em PostgreSQL.

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

CREATE TABLE "leadFiles" (
    "id" serial PRIMARY KEY NOT NULL,
    "idLead" integer NOT NULL,
    "idUsuario" integer NOT NULL,
    "nomeArquivo" varchar(255) NOT NULL,
    "urlArquivo" varchar(500) NOT NULL,
    "tipoArquivo" varchar(100),
    "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "leadNotes" (
    "id" serial PRIMARY KEY NOT NULL,
    "idLead" integer NOT NULL,
    "idUsuario" integer NOT NULL,
    "anotacao" text NOT NULL,
    "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "leads" (
    "id" serial PRIMARY KEY NOT NULL,
    "nome" varchar(255) NOT NULL,
    "email" varchar(320),
    "cpf" varchar(14),
    "telefone" varchar(20),
    "origem" varchar(100),
    "interesse" text,
    "observacao" text,
    "status" varchar(50) DEFAULT 'novo' NOT NULL,
    "userId" integer,
    "idResponsavel" integer,
    "idImovel" integer,
    "createdAt" timestamp DEFAULT now() NOT NULL,
    "updatedAt" timestamp DEFAULT now() NOT NULL
);

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

CREATE UNIQUE INDEX "propertyOwners_cpf_idx"
ON "propertyOwners" ("cpf");

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
    "idProprietario" integer,
    "createdByUserId" integer NOT NULL,
    "createdAt" timestamp DEFAULT now() NOT NULL,
    "updatedAt" timestamp DEFAULT now() NOT NULL
);

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

CREATE TABLE "users" (
    "id" serial PRIMARY KEY NOT NULL,
    "openId" varchar(64) NOT NULL,
    "name" text,
    "email" varchar(320),
    "cpf" varchar(14),
    "phone" varchar(20),
    "creci" varchar(32),
    "creciStatus" varchar(20),
    "creciVerifiedAt" timestamp,
    "creciVerifiedByUserId" integer,
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

CREATE TABLE "adminUserViews" (
    "id" serial PRIMARY KEY NOT NULL,
    "adminUserId" integer NOT NULL,
    "viewedUserId" integer NOT NULL,
    "viewedAt" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "adminUserViews_adminUserId_viewedUserId_idx"
ON "adminUserViews" ("adminUserId", "viewedUserId");

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON "users"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER properties_set_updated_at
BEFORE UPDATE ON "properties"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER property_owners_set_updated_at
BEFORE UPDATE ON "propertyOwners"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER property_documents_set_updated_at
BEFORE UPDATE ON "propertyDocuments"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER leads_set_updated_at
BEFORE UPDATE ON "leads"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER contracts_set_updated_at
BEFORE UPDATE ON "contracts"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER documents_set_updated_at
BEFORE UPDATE ON "documents"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

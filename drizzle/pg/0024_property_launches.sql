CREATE TABLE IF NOT EXISTS "propertyLaunches" (
  "id" serial PRIMARY KEY NOT NULL,
  "nome" varchar(180) NOT NULL,
  "descricao" text,
  "construtora" varchar(160),
  "tipo" varchar(50) NOT NULL,
  "status" varchar(30) DEFAULT 'lancamento' NOT NULL,
  "entregaPrevista" date,
  "valorMin" integer NOT NULL,
  "valorMax" integer,
  "areaMin" integer,
  "areaMax" integer,
  "quartosMin" integer,
  "quartosMax" integer,
  "vagasMin" integer,
  "vagasMax" integer,
  "unidadesDisponiveis" integer,
  "endereco" varchar(255) NOT NULL,
  "numero" varchar(20),
  "bairro" varchar(100),
  "cidade" varchar(100) NOT NULL,
  "estado" varchar(2) NOT NULL,
  "cep" varchar(10),
  "fotos" text,
  "destaque" integer DEFAULT 0 NOT NULL,
  "isAtivo" integer DEFAULT 1 NOT NULL,
  "createdByUserId" integer,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "propertyLaunches_isAtivo_idx" ON "propertyLaunches" ("isAtivo");
CREATE INDEX IF NOT EXISTS "propertyLaunches_cidade_estado_idx" ON "propertyLaunches" ("cidade", "estado");

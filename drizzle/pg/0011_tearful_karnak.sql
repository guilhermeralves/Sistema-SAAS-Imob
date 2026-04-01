ALTER TABLE "properties" ADD COLUMN "lixeira" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "motivoExclusao" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "excluidoPorUserId" integer;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "excluidoAt" timestamp;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "inscricaoImobiliaria" varchar(120);--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "matriculaRegistro" varchar(120);--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "cartorioRegistro" varchar(160);--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "registroMunicipal" varchar(120);--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "informacoesLegais" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "observacoesJuridicas" text;
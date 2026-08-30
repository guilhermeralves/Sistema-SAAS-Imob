import "dotenv/config";
import { Client } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("[manual-db-sync] DATABASE_URL nao definido.");
  process.exit(1);
}

const MANUAL_MIGRATIONS_TABLE = '"manualMigrations"';

const patches = [
  {
    id: "2026-04-01_property_key_status",
    description: "Adiciona colunas de status de chave em properties e cria propertyKeyStatusRequests",
    statements: [
      `ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "keyStatus" varchar(20);`,
      `UPDATE "properties" SET "keyStatus" = 'disponivel' WHERE "keyStatus" IS NULL;`,
      `ALTER TABLE "properties" ALTER COLUMN "keyStatus" SET DEFAULT 'disponivel';`,
      `ALTER TABLE "properties" ALTER COLUMN "keyStatus" SET NOT NULL;`,

      `ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "keyStatusObservation" text;`,
      `UPDATE "properties" SET "keyStatusObservation" = 'Chaves disponiveis na imobiliaria.' WHERE "keyStatusObservation" IS NULL;`,
      `ALTER TABLE "properties" ALTER COLUMN "keyStatusObservation" SET DEFAULT 'Chaves disponiveis na imobiliaria.';`,
      `ALTER TABLE "properties" ALTER COLUMN "keyStatusObservation" SET NOT NULL;`,

      `ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "keyStatusUpdatedByUserId" integer;`,
      `ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "keyStatusUpdatedAt" timestamp;`,
      `UPDATE "properties" SET "keyStatusUpdatedAt" = now() WHERE "keyStatusUpdatedAt" IS NULL;`,
      `ALTER TABLE "properties" ALTER COLUMN "keyStatusUpdatedAt" SET DEFAULT now();`,
      `ALTER TABLE "properties" ALTER COLUMN "keyStatusUpdatedAt" SET NOT NULL;`,

      `CREATE TABLE IF NOT EXISTS "propertyKeyStatusRequests" (
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
      );`,
      `CREATE INDEX IF NOT EXISTS "propertyKeyStatusRequests_idImovel_idx" ON "propertyKeyStatusRequests" ("idImovel");`,
      `CREATE INDEX IF NOT EXISTS "propertyKeyStatusRequests_status_idx" ON "propertyKeyStatusRequests" ("status");`,

      `CREATE OR REPLACE FUNCTION set_property_key_status_requests_updated_at()
      RETURNS TRIGGER AS $fn$
      BEGIN
        NEW."updatedAt" = NOW();
        RETURN NEW;
      END;
      $fn$ LANGUAGE plpgsql;`,
      `DROP TRIGGER IF EXISTS property_key_status_requests_set_updated_at ON "propertyKeyStatusRequests";`,
      `CREATE TRIGGER property_key_status_requests_set_updated_at
      BEFORE UPDATE ON "propertyKeyStatusRequests"
      FOR EACH ROW
      EXECUTE FUNCTION set_property_key_status_requests_updated_at();`,
    ],
  },
  {
    id: "2026-04-02_property_soft_delete_and_legal_profile",
    description: "Adiciona lixeira e campos legais/juridicos na ficha do imovel",
    statements: [
      `ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "lixeira" integer;`,
      `UPDATE "properties" SET "lixeira" = 0 WHERE "lixeira" IS NULL;`,
      `ALTER TABLE "properties" ALTER COLUMN "lixeira" SET DEFAULT 0;`,
      `ALTER TABLE "properties" ALTER COLUMN "lixeira" SET NOT NULL;`,

      `ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "motivoExclusao" text;`,
      `ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "excluidoPorUserId" integer;`,
      `ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "excluidoAt" timestamp;`,

      `ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "inscricaoImobiliaria" varchar(120);`,
      `ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "matriculaRegistro" varchar(120);`,
      `ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "cartorioRegistro" varchar(160);`,
      `ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "registroMunicipal" varchar(120);`,
      `ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "informacoesLegais" text;`,
      `ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "observacoesJuridicas" text;`,
    ],
  },
  {
    id: "2026-04-14_lead_birth_date",
    description: "Adiciona data de nascimento no lead e sincroniza com usuarios vinculados",
    statements: [
      `ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "birthDate" date;`,
      `UPDATE "leads" AS lead
       SET "birthDate" = usr."birthDate"
       FROM "users" AS usr
       WHERE lead."userId" = usr."id"
         AND lead."birthDate" IS NULL
         AND usr."birthDate" IS NOT NULL;`,
    ],
  },
  {
    id: "2026-04-14_lead_sla_and_interactions",
    description: "Adiciona campos de SLA no lead e cria historico de interacoes",
    statements: [
      `ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "assignmentCycleStartedAt" timestamp;`,
      `UPDATE "leads" SET "assignmentCycleStartedAt" = COALESCE("assignmentCycleStartedAt", "createdAt", now());`,
      `ALTER TABLE "leads" ALTER COLUMN "assignmentCycleStartedAt" SET DEFAULT now();`,
      `ALTER TABLE "leads" ALTER COLUMN "assignmentCycleStartedAt" SET NOT NULL;`,

      `ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "assignedAt" timestamp;`,
      `ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "attendedAt" timestamp;`,
      `ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "assignmentSlaNotifiedAt" timestamp;`,

      `CREATE TABLE IF NOT EXISTS "leadInteractions" (
        "id" serial PRIMARY KEY NOT NULL,
        "idLead" integer NOT NULL,
        "idUsuario" integer,
        "eventType" varchar(80) NOT NULL,
        "message" text NOT NULL,
        "createdAt" timestamp DEFAULT now() NOT NULL
      );`,
      `CREATE INDEX IF NOT EXISTS "leadInteractions_idLead_idx" ON "leadInteractions" ("idLead");`,
      `CREATE INDEX IF NOT EXISTS "leadInteractions_createdAt_idx" ON "leadInteractions" ("createdAt");`,

      `INSERT INTO "leadInteractions" ("idLead", "idUsuario", "eventType", "message", "createdAt")
       SELECT l."id", NULL, 'lead_created', 'Lead criado no sistema.', COALESCE(l."createdAt", now())
       FROM "leads" l
       WHERE NOT EXISTS (
         SELECT 1 FROM "leadInteractions" i
         WHERE i."idLead" = l."id" AND i."eventType" = 'lead_created'
       );`,
    ],
  },
  {
    id: "2026-06-07_rental_proposal_reference_code",
    description: "Adiciona referenceCode na proposta de locacao para o codigo de referencia gerado na aprovacao dos contratos",
    statements: [
      `ALTER TABLE "rentalProposals" ADD COLUMN IF NOT EXISTS "referenceCode" varchar(40);`,
    ],
  },
  {
    id: "2026-06-07_rental_proposal_lease_terms",
    description: "Adiciona periodo de reajuste, taxa de administracao, dias uteis de repasse e multa rescisoria na proposta de locacao",
    statements: [
      `ALTER TABLE "rentalProposals" ADD COLUMN IF NOT EXISTS "adjustmentPeriod" varchar(20);`,
      `ALTER TABLE "rentalProposals" ADD COLUMN IF NOT EXISTS "administrationFeePercent" integer;`,
      `ALTER TABLE "rentalProposals" ADD COLUMN IF NOT EXISTS "transferBusinessDays" integer;`,
      `ALTER TABLE "rentalProposals" ADD COLUMN IF NOT EXISTS "terminationPenaltyType" varchar(20);`,
      `ALTER TABLE "rentalProposals" ADD COLUMN IF NOT EXISTS "terminationPenaltyAmount" integer;`,
    ],
  },
  {
    id: "2026-06-07_rental_proposal_boletos",
    description: "Cria tabela de boletos da proposta de locacao para gerar, editar e aprovar as parcelas de toda a vigencia",
    statements: [
      `CREATE TABLE IF NOT EXISTS "rentalProposalBoletos" (
        "id" serial PRIMARY KEY NOT NULL,
        "rentalProposalId" integer NOT NULL,
        "installmentNumber" integer NOT NULL,
        "referenceMonth" date NOT NULL,
        "dueDate" date NOT NULL,
        "rentAmount" integer NOT NULL,
        "condominiumAmount" integer,
        "extraAmount" integer DEFAULT 0 NOT NULL,
        "extraDescription" varchar(180),
        "totalAmount" integer NOT NULL,
        "status" varchar(20) DEFAULT 'pendente' NOT NULL,
        "notes" text,
        "approvedAt" timestamp,
        "approvedByUserId" integer,
        "paidAt" timestamp,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL
      );`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "rentalProposalBoletos_unique_idx"
        ON "rentalProposalBoletos" ("rentalProposalId","installmentNumber");`,
    ],
  },
  {
    id: "2026-06-07_rental_proposal_boletos_paid_at",
    description: "Adiciona paidAt em rentalProposalBoletos para baixa de pagamento (status Pago via integracao)",
    statements: [
      `ALTER TABLE "rentalProposalBoletos" ADD COLUMN IF NOT EXISTS "paidAt" timestamp;`,
    ],
  },
  {
    id: "2026-06-22_push_subscriptions",
    description: "Cria tabela de inscricoes de Web Push por usuario para notificar corretores no celular",
    statements: [
      `CREATE TABLE IF NOT EXISTS "pushSubscriptions" (
        "id" serial PRIMARY KEY NOT NULL,
        "userId" integer NOT NULL,
        "endpoint" text NOT NULL,
        "p256dh" text NOT NULL,
        "auth" text NOT NULL,
        "userAgent" varchar(255),
        "createdAt" timestamp DEFAULT now() NOT NULL
      );`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "pushSubscriptions_endpoint_idx" ON "pushSubscriptions" ("endpoint");`,
      `CREATE INDEX IF NOT EXISTS "pushSubscriptions_userId_idx" ON "pushSubscriptions" ("userId");`,
    ],
  },
  {
    id: "2026-06-23_user_notifications",
    description: "Cria tabela de historico de notificacoes por usuario (sino no cabecalho)",
    statements: [
      `CREATE TABLE IF NOT EXISTS "userNotifications" (
        "id" serial PRIMARY KEY NOT NULL,
        "userId" integer NOT NULL,
        "title" varchar(160) NOT NULL,
        "body" text NOT NULL,
        "url" varchar(512),
        "isRead" integer DEFAULT 0 NOT NULL,
        "createdAt" timestamp DEFAULT now() NOT NULL
      );`,
      `CREATE INDEX IF NOT EXISTS "userNotifications_userId_idx" ON "userNotifications" ("userId");`,
      `CREATE INDEX IF NOT EXISTS "userNotifications_createdAt_idx" ON "userNotifications" ("createdAt");`,
    ],
  },
  {
    id: "2026-06-27_rental_proposal_insurances",
    description:
      "Cria tabela de seguros (fianca/incendio) por proposta de locacao com comprovante e confirmacao",
    statements: [
      `CREATE TABLE IF NOT EXISTS "rentalProposalInsurances" (
        "id" serial PRIMARY KEY NOT NULL,
        "rentalProposalId" integer NOT NULL,
        "kind" varchar(20) NOT NULL,
        "status" varchar(20) DEFAULT 'pendente' NOT NULL,
        "insurer" varchar(160),
        "policyNumber" varchar(80),
        "amount" integer,
        "proofData" text,
        "proofFileName" varchar(255),
        "proofContentType" varchar(120),
        "notes" text,
        "requestedAt" timestamp,
        "confirmedAt" timestamp,
        "confirmedByUserId" integer,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL
      );`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "rentalProposalInsurances_unique_idx" ON "rentalProposalInsurances" ("rentalProposalId", "kind");`,
    ],
  },
  {
    id: "2026-06-28_rental_proposal_signatures",
    description:
      "Cria tabela de assinaturas digitais (D4Sign) por contrato aprovado de proposta de locacao",
    statements: [
      `CREATE TABLE IF NOT EXISTS "rentalProposalSignatures" (
        "id" serial PRIMARY KEY NOT NULL,
        "rentalProposalId" integer NOT NULL,
        "generatedContractId" integer NOT NULL,
        "provider" varchar(20) DEFAULT 'd4sign' NOT NULL,
        "environment" varchar(20),
        "status" varchar(20) DEFAULT 'pendente' NOT NULL,
        "externalDocumentUuid" varchar(80),
        "signersSnapshot" text,
        "signedFileData" text,
        "signedFileName" varchar(255),
        "lastError" text,
        "sentAt" timestamp,
        "signedAt" timestamp,
        "sentByUserId" integer,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL
      );`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "rentalProposalSignatures_unique_idx" ON "rentalProposalSignatures" ("rentalProposalId", "generatedContractId");`,
    ],
  },
  {
    id: "2026-06-28_rental_proposal_utility_transfers",
    description:
      "Cria tabela de transferencia de titularidade de contas (energia/agua/gas) por proposta de locacao",
    statements: [
      `CREATE TABLE IF NOT EXISTS "rentalProposalUtilityTransfers" (
        "id" serial PRIMARY KEY NOT NULL,
        "rentalProposalId" integer NOT NULL,
        "kind" varchar(20) NOT NULL,
        "status" varchar(20) DEFAULT 'pendente' NOT NULL,
        "proofData" text,
        "proofFileName" varchar(255),
        "proofContentType" varchar(120),
        "notes" text,
        "requestedAt" timestamp,
        "confirmedAt" timestamp,
        "confirmedByUserId" integer,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL
      );`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "rentalProposalUtilityTransfers_unique_idx" ON "rentalProposalUtilityTransfers" ("rentalProposalId", "kind");`,
    ],
  },
  {
    id: "2026-06-28_rental_utility_transfers_custom",
    description:
      "Permite contas personalizadas na transferencia de titularidade (coluna label + kind mais largo)",
    statements: [
      `ALTER TABLE "rentalProposalUtilityTransfers" ALTER COLUMN "kind" TYPE varchar(40);`,
      `ALTER TABLE "rentalProposalUtilityTransfers" ADD COLUMN IF NOT EXISTS "label" varchar(160);`,
    ],
  },
  {
    id: "2026-06-28_rental_proposal_inspections",
    description:
      "Cria tabela de vistoria e laudo (etapas 27-28) por proposta de locacao",
    statements: [
      `CREATE TABLE IF NOT EXISTS "rentalProposalInspections" (
        "id" serial PRIMARY KEY NOT NULL,
        "rentalProposalId" integer NOT NULL UNIQUE,
        "status" varchar(20) DEFAULT 'pendente' NOT NULL,
        "inspectorName" varchar(160),
        "inspectorPhone" varchar(40),
        "inspectorEmail" varchar(255),
        "scheduledAt" date,
        "requestedAt" timestamp,
        "laudoData" text,
        "laudoFileName" varchar(255),
        "laudoContentType" varchar(120),
        "tenantValidatedAt" timestamp,
        "ownerValidatedAt" timestamp,
        "notes" text,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL
      );`,
    ],
  },
  {
    id: "2026-06-28_rental_inspection_selfie_validation",
    description:
      "Validacao de vistoria com selfie por locatario/proprietario (tokens + selfies)",
    statements: [
      `ALTER TABLE "rentalProposalInspections" ADD COLUMN IF NOT EXISTS "tenantSelfieData" text;`,
      `ALTER TABLE "rentalProposalInspections" ADD COLUMN IF NOT EXISTS "ownerSelfieData" text;`,
      `ALTER TABLE "rentalProposalInspections" ADD COLUMN IF NOT EXISTS "tenantValidatedByUserId" integer;`,
      `ALTER TABLE "rentalProposalInspections" ADD COLUMN IF NOT EXISTS "ownerValidatedByUserId" integer;`,
      `ALTER TABLE "rentalProposalInspections" ADD COLUMN IF NOT EXISTS "tenantValidationToken" varchar(40);`,
      `ALTER TABLE "rentalProposalInspections" ADD COLUMN IF NOT EXISTS "ownerValidationToken" varchar(40);`,
    ],
  },
  {
    id: "2026-06-28_users_tasks_seen_at",
    description:
      "Marca da ultima visualizacao da tela de Tarefas e Eventos (badge de novos)",
    statements: [
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tasksSeenAt" timestamp;`,
    ],
  },
  {
    id: "2026-06-28_task_item_views",
    description:
      "Registra quais tarefas/eventos cada usuario ja abriu (badge por-tarefa)",
    statements: [
      `CREATE TABLE IF NOT EXISTS "taskItemViews" (
        "id" serial PRIMARY KEY NOT NULL,
        "taskId" integer NOT NULL,
        "userId" integer NOT NULL,
        "viewedAt" timestamp DEFAULT now() NOT NULL
      );`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "taskItemViews_taskId_userId_idx" ON "taskItemViews" ("taskId", "userId");`,
    ],
  },
  {
    id: "2026-07-04_attendance_roulette",
    description:
      "Cria tabelas da Roleta de Atendimentos: filas, permissoes de corretores e participantes",
    statements: [
      `CREATE TABLE IF NOT EXISTS "attendanceQueues" (
        "id" serial PRIMARY KEY NOT NULL,
        "tenantId" integer,
        "name" varchar(120) NOT NULL,
        "description" text,
        "isActive" integer DEFAULT 1 NOT NULL,
        "isDefault" integer DEFAULT 0 NOT NULL,
        "orderStrategy" varchar(20) DEFAULT 'round_robin' NOT NULL,
        "assignmentTimeoutMinutes" integer DEFAULT 15 NOT NULL,
        "attendanceTimeoutMinutes" integer DEFAULT 40 NOT NULL,
        "businessHoursOnly" integer DEFAULT 1 NOT NULL,
        "createdByUserId" integer NOT NULL,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL
      );`,

      `CREATE TABLE IF NOT EXISTS "attendanceQueueMembers" (
        "id" serial PRIMARY KEY NOT NULL,
        "queueId" integer NOT NULL,
        "userId" integer NOT NULL,
        "canJoin" integer DEFAULT 1 NOT NULL,
        "createdByUserId" integer,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL
      );`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "attendanceQueueMembers_queueId_userId_idx" ON "attendanceQueueMembers" ("queueId", "userId");`,

      `CREATE TABLE IF NOT EXISTS "attendanceQueueParticipants" (
        "id" serial PRIMARY KEY NOT NULL,
        "queueId" integer NOT NULL,
        "userId" integer NOT NULL,
        "position" integer DEFAULT 0 NOT NULL,
        "isActive" integer DEFAULT 1 NOT NULL,
        "joinedAt" timestamp DEFAULT now() NOT NULL,
        "leftAt" timestamp,
        "lastAssignedAt" timestamp,
        "updatedAt" timestamp DEFAULT now() NOT NULL
      );`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "attendanceQueueParticipants_queueId_userId_idx" ON "attendanceQueueParticipants" ("queueId", "userId");`,
      `CREATE INDEX IF NOT EXISTS "attendanceQueueParticipants_queueId_idx" ON "attendanceQueueParticipants" ("queueId");`,
    ],
  },
  {
    id: "2026-08-29_tenants_and_licenses",
    description:
      "Cria tenants, licenses e licensePayments; seed do tenant AFG e licença ativa",
    statements: [
      `CREATE TABLE IF NOT EXISTS "tenants" (
        "id" serial PRIMARY KEY NOT NULL,
        "slug" varchar(64) NOT NULL,
        "nome" varchar(200) NOT NULL,
        "cnpj" varchar(18),
        "email" varchar(320),
        "telefone" varchar(20),
        "cidade" varchar(100),
        "estado" varchar(2),
        "isActive" integer DEFAULT 1 NOT NULL,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL
      );`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "tenants_slug_idx" ON "tenants" ("slug");`,

      `CREATE TABLE IF NOT EXISTS "licenses" (
        "id" serial PRIMARY KEY NOT NULL,
        "tenantId" integer NOT NULL,
        "status" varchar(20) DEFAULT 'active' NOT NULL,
        "valorCentavos" integer DEFAULT 0 NOT NULL,
        "dueDate" date NOT NULL,
        "gracePeriodDays" integer DEFAULT 7 NOT NULL,
        "lastPaidAt" timestamp,
        "notes" text,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL
      );`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "licenses_tenantId_idx" ON "licenses" ("tenantId");`,

      `CREATE TABLE IF NOT EXISTS "licensePayments" (
        "id" serial PRIMARY KEY NOT NULL,
        "licenseId" integer NOT NULL,
        "tenantId" integer NOT NULL,
        "valorCentavos" integer NOT NULL,
        "paidAt" timestamp NOT NULL,
        "competenciaDe" date NOT NULL,
        "competenciaAte" date NOT NULL,
        "registradoPorUserId" integer,
        "observacao" text,
        "createdAt" timestamp DEFAULT now() NOT NULL
      );`,
      `CREATE INDEX IF NOT EXISTS "licensePayments_tenantId_idx" ON "licensePayments" ("tenantId");`,

      `INSERT INTO "tenants" ("slug", "nome", "cidade", "estado")
       SELECT 'afg', 'AFG Imóveis', 'Interior SP', 'SP'
       WHERE NOT EXISTS (SELECT 1 FROM "tenants" WHERE "slug" = 'afg');`,

      `INSERT INTO "licenses" ("tenantId", "status", "valorCentavos", "dueDate", "gracePeriodDays")
       SELECT t.id, 'active', 0, (CURRENT_DATE + INTERVAL '30 days')::date, 7
       FROM "tenants" t
       WHERE t.slug = 'afg'
         AND NOT EXISTS (SELECT 1 FROM "licenses" l WHERE l."tenantId" = t.id);`,
    ],
  },
  {
    id: "2026-08-29_tenants_endereco_e_softdelete",
    description:
      "Adiciona CEP/endereço/CRECI-PJ e inactivatedAt em tenants (soft-delete)",
    statements: [
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "creciPj" varchar(32);`,
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "cep" varchar(10);`,
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "endereco" varchar(255);`,
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "numero" varchar(20);`,
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "complemento" varchar(120);`,
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "bairro" varchar(100);`,
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "inactivatedAt" timestamp;`,
    ],
  },
  {
    id: "2026-08-30_system_parameters",
    description:
      "Cria systemParameters (linha única com dados imobiliária, corretor responsável, financeiros e comissões)",
    statements: [
      `CREATE TABLE IF NOT EXISTS "systemParameters" (
        "id" serial PRIMARY KEY NOT NULL,
        "imobNomeFantasia" varchar(200),
        "imobRazaoSocial" varchar(200),
        "imobCnpj" varchar(18),
        "imobCreciPj" varchar(32),
        "imobInscricaoEstadual" varchar(32),
        "imobTelefone" varchar(20),
        "imobEmail" varchar(320),
        "imobCep" varchar(10),
        "imobEndereco" varchar(255),
        "imobNumero" varchar(20),
        "imobComplemento" varchar(120),
        "imobBairro" varchar(100),
        "imobCidade" varchar(100),
        "imobEstado" varchar(2),
        "respNome" varchar(200),
        "respCpf" varchar(14),
        "respCreci" varchar(32),
        "respTelefone" varchar(20),
        "respEmail" varchar(320),
        "bancoNome" varchar(100),
        "bancoAgencia" varchar(20),
        "bancoConta" varchar(30),
        "bancoTipoConta" varchar(10),
        "bancoTitular" varchar(200),
        "bancoTitularDoc" varchar(18),
        "pixTipo" varchar(12),
        "pixChave" varchar(100),
        "comissaoVendaBps" integer DEFAULT 600 NOT NULL,
        "comissaoLocacaoBps" integer DEFAULT 1000 NOT NULL,
        "comissaoImobiliariaBps" integer DEFAULT 5000 NOT NULL,
        "comissaoCorretorBps" integer DEFAULT 5000 NOT NULL,
        "diaPagamentoCorretor" integer DEFAULT 10 NOT NULL,
        "metodoPagamentoCorretor" varchar(10) DEFAULT 'pix' NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL,
        "updatedByUserId" integer
      );`,
      // Linha única sempre presente (id=1)
      `INSERT INTO "systemParameters" ("id") VALUES (1) ON CONFLICT DO NOTHING;`,
    ],
  },
  {
    id: "2026-08-30_license_activation_table",
    description:
      "Cria licenseActivation (linha única guardando token JWT do NOXILON Central)",
    statements: [
      `CREATE TABLE IF NOT EXISTS "licenseActivation" (
        "id" serial PRIMARY KEY NOT NULL,
        "tenantId" integer NOT NULL,
        "tenantSlug" varchar(64) NOT NULL,
        "tenantNome" varchar(200) NOT NULL,
        "activationCodeId" integer NOT NULL,
        "token" text NOT NULL,
        "licenseStatus" varchar(20) DEFAULT 'active' NOT NULL,
        "dueDate" date,
        "tokenExpiresAt" timestamp NOT NULL,
        "activatedAt" timestamp DEFAULT now() NOT NULL,
        "lastHeartbeatAt" timestamp,
        "lastHeartbeatError" text,
        "centralUrl" varchar(255) NOT NULL
      );`,
    ],
  },
];

async function ensureManualMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${MANUAL_MIGRATIONS_TABLE} (
      "id" text PRIMARY KEY,
      "description" text NOT NULL,
      "appliedAt" timestamp DEFAULT now() NOT NULL
    );
  `);
}

async function getAppliedPatchIds(client) {
  const result = await client.query(`SELECT "id" FROM ${MANUAL_MIGRATIONS_TABLE};`);
  return new Set(result.rows.map(row => row.id));
}

async function applyPatch(client, patch) {
  await client.query("BEGIN");
  try {
    for (const statement of patch.statements) {
      await client.query(statement);
    }
    await client.query(
      `INSERT INTO ${MANUAL_MIGRATIONS_TABLE} ("id", "description") VALUES ($1, $2);`,
      [patch.id, patch.description]
    );
    await client.query("COMMIT");
    return { applied: true };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function run() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    await ensureManualMigrationsTable(client);
    const appliedPatchIds = await getAppliedPatchIds(client);

    const summary = [];

    for (const patch of patches) {
      if (appliedPatchIds.has(patch.id)) {
        summary.push({ id: patch.id, status: "already_applied" });
        continue;
      }

      await applyPatch(client, patch);
      summary.push({ id: patch.id, status: "applied" });
    }

    const propertiesColumnsResult = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'properties'
      ORDER BY ordinal_position;
    `);

    const keyRequestsTableResult = await client.query(
      `SELECT to_regclass('public."propertyKeyStatusRequests"') AS name;`
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          summary,
          propertiesColumns: propertiesColumnsResult.rows.map(row => row.column_name),
          propertyKeyStatusRequestsTable: keyRequestsTableResult.rows[0]?.name ?? null,
        },
        null,
        2
      )
    );
  } finally {
    await client.end();
  }
}

run().catch(error => {
  console.error("[manual-db-sync] Erro ao aplicar patches manuais.");
  console.error(error);
  process.exit(1);
});

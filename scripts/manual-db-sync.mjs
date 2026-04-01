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

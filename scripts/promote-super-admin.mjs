import "dotenv/config";
import { Client } from "pg";

const email = process.argv[2];

if (!email) {
  console.error(
    "Uso: node scripts/promote-super-admin.mjs <email>\n" +
      "  Ex: node scripts/promote-super-admin.mjs dev.rodriguees@gmail.com"
  );
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL não definido.");
  process.exit(1);
}

const client = new Client({ connectionString });
await client.connect();

try {
  const found = await client.query(
    `SELECT id, name, email, role FROM "users" WHERE email = $1;`,
    [email]
  );

  if (found.rows.length === 0) {
    console.error(`Nenhum usuário encontrado com email ${email}.`);
    process.exit(1);
  }

  const target = found.rows[0];
  console.log(
    `Promovendo ${target.name ?? "(sem nome)"} (id=${target.id}, role atual: ${target.role}) para super_admin…`
  );

  await client.query(
    `UPDATE "users" SET role = 'super_admin', "updatedAt" = now() WHERE id = $1;`,
    [target.id]
  );

  console.log("Feito. Faça logout/login para o novo papel ter efeito.");
} finally {
  await client.end();
}

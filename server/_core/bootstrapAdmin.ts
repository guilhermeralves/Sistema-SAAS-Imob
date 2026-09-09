import { nanoid } from "nanoid";
import {
  createUser,
  getDb,
  getUserByEmail,
  getUserByOpenId,
  updateUser,
} from "../db";
import { ENV } from "./env";
import { hashPassword } from "./passwords";

const ROOT_ADMIN_NAME = "Administrador";

function hasBootstrapCredentials() {
  return ENV.ownerEmail.trim().length > 0 && ENV.ownerPassword.trim().length > 0;
}

export async function ensureBootstrapAdmin() {
  if (!hasBootstrapCredentials()) {
    return;
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Auth] Skipping admin bootstrap because the database is unavailable");
    return;
  }

  const email = ENV.ownerEmail.trim().toLowerCase();
  const bootstrapOpenId =
    ENV.ownerOpenId || `local:bootstrap-admin:${nanoid(8)}`;

  // 1) Tenta encontrar pelo email (caso o email do .env já esteja no banco).
  // 2) Se não achar por email mas o openId do bootstrap existir, usa esse
  //    registro (isso cobre o caso do OWNER_EMAIL ter sido alterado no .env
  //    depois do primeiro boot — a linha antiga é atualizada em vez de criar
  //    outra e violar UNIQUE(openId)).
  let existingUser =
    (await getUserByEmail(email)) ?? (await getUserByOpenId(bootstrapOpenId));

  if (!existingUser) {
    const passwordHash = await hashPassword(ENV.ownerPassword);

    await createUser({
      openId: bootstrapOpenId,
      name: ROOT_ADMIN_NAME,
      email,
      loginMethod: "password",
      passwordHash,
      registrationSource: "bootstrap",
      role: "administrativo",
      isActive: 1,
      lastSignedIn: new Date(),
    });

    console.log(`[Auth] Bootstrap admin created for ${email}`);
    return;
  }

  // Se o usuário atual tem email diferente do .env, sincroniza.
  if (existingUser.email !== email) {
    await updateUser(existingUser.id, { email });
    existingUser = { ...existingUser, email };
  }

  // Sempre re-sincroniza a senha do .env (senha é fonte de verdade lá).
  const passwordHash = await hashPassword(ENV.ownerPassword);
  await updateUser(existingUser.id, {
    passwordHash,
    loginMethod: "password",
  });

  const updatePayload: Record<string, unknown> = {};

  if (existingUser.role !== "administrativo") {
    updatePayload.role = "administrativo";
  }

  if (existingUser.registrationSource !== "bootstrap") {
    updatePayload.registrationSource = "bootstrap";
  }

  if (existingUser.isActive !== 1) {
    updatePayload.isActive = 1;
  }

  if (existingUser.name !== ROOT_ADMIN_NAME) {
    updatePayload.name = ROOT_ADMIN_NAME;
  }

  if (!existingUser.passwordHash) {
    updatePayload.passwordHash = await hashPassword(ENV.ownerPassword);
    updatePayload.loginMethod = "password";
  }

  const fixedEmptyFields = [
    "cpf",
    "phone",
    "creci",
    "creciStatus",
    "creciVerifiedAt",
    "creciVerifiedByUserId",
    "birthDate",
    "profession",
    "grossMonthlyIncome",
    "maritalStatus",
    "householdIncome",
    "rg",
    "nationality",
    "address",
    "neighborhood",
    "addressNumber",
    "city",
    "state",
    "zipCode",
    "notes",
  ] as const;

  for (const field of fixedEmptyFields) {
    if ((existingUser as Record<string, unknown>)[field] !== null) {
      updatePayload[field] = null;
    }
  }

  if (Object.keys(updatePayload).length === 0) {
    return;
  }

  await updateUser(existingUser.id, updatePayload);
  console.log(`[Auth] Bootstrap admin synchronized for ${email}`);
}

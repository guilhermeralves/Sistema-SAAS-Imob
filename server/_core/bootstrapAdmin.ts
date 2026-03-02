import { nanoid } from "nanoid";
import { createUser, getDb, getUserByEmail, updateUser } from "../db";
import { ENV } from "./env";
import { hashPassword } from "./passwords";

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
  const existingUser = await getUserByEmail(email);

  if (!existingUser) {
    const passwordHash = await hashPassword(ENV.ownerPassword);

    await createUser({
      openId: ENV.ownerOpenId || `local:bootstrap-admin:${nanoid(8)}`,
      name: ENV.ownerName.trim() || "Administrador",
      email,
      loginMethod: "password",
      passwordHash,
      role: "administrativo",
      isActive: 1,
      lastSignedIn: new Date(),
    });

    console.log(`[Auth] Bootstrap admin created for ${email}`);
    return;
  }

  const updatePayload: Record<string, unknown> = {};

  if (existingUser.role !== "administrativo") {
    updatePayload.role = "administrativo";
  }

  if (existingUser.isActive !== 1) {
    updatePayload.isActive = 1;
  }

  const configuredName = ENV.ownerName.trim();
  if (configuredName && existingUser.name !== configuredName) {
    updatePayload.name = configuredName;
  }

  if (!existingUser.passwordHash) {
    updatePayload.passwordHash = await hashPassword(ENV.ownerPassword);
    updatePayload.loginMethod = "password";
  }

  if (Object.keys(updatePayload).length === 0) {
    return;
  }

  await updateUser(existingUser.id, updatePayload);
  console.log(`[Auth] Bootstrap admin synchronized for ${email}`);
}

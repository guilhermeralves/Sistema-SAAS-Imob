import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import {
  adminUserViews,
  InsertContract,
  InsertAdminUserView,
  InsertDocument,
  InsertLead,
  InsertLeadFile,
  InsertLeadNote,
  InsertProperty,
  InsertUser,
  contracts,
  documents,
  leadFiles,
  leadNotes,
  leads,
  properties,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  const values: InsertUser = {
    openId: user.openId,
  };
  const updateSet: Record<string, unknown> = {};

  const textFields = [
    "name",
    "email",
    "cpf",
    "phone",
    "creci",
    "profession",
    "maritalStatus",
    "rg",
    "nationality",
    "address",
    "neighborhood",
    "addressNumber",
    "city",
    "state",
    "zipCode",
    "notes",
    "loginMethod",
    "passwordHash",
  ] as const;
  type TextField = (typeof textFields)[number];

  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };

  textFields.forEach(assignNullable);

  if (user.registrationSource !== undefined) {
    values.registrationSource = user.registrationSource;
    updateSet.registrationSource = user.registrationSource;
  }

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }

  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "administrativo";
    updateSet.role = "administrativo";
  }

  if (user.isActive !== undefined) {
    values.isActive = user.isActive;
    updateSet.isActive = user.isActive;
  } else {
    values.isActive = 1;
  }

  if (user.birthDate !== undefined) {
    values.birthDate = user.birthDate;
    updateSet.birthDate = user.birthDate;
  }
  if (user.grossMonthlyIncome !== undefined) {
    values.grossMonthlyIncome = user.grossMonthlyIncome;
    updateSet.grossMonthlyIncome = user.grossMonthlyIncome;
  }
  if (user.householdIncome !== undefined) {
    values.householdIncome = user.householdIncome;
    updateSet.householdIncome = user.householdIncome;
  }

  if (!values.lastSignedIn) {
    values.lastSignedIn = new Date();
  }

  if (Object.keys(updateSet).length === 0) {
    updateSet.lastSignedIn = new Date();
  }

  await db.insert(users).values(values).onConflictDoUpdate({
    target: users.openId,
    set: updateSet,
  });
}

export async function createUser(user: InsertUser) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (!user.openId) throw new Error("User openId is required");

  await db.insert(users).values(user);

  const createdUser = await getUserByOpenId(user.openId);
  if (!createdUser) {
    throw new Error("Failed to load created user");
  }

  return createdUser;
}

export async function deleteUserById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(users).where(eq(users.id, id));
}

export async function revokeUserAccess(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(users)
    .set({
      isActive: 0,
      loginMethod: null,
      passwordHash: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, id));
}

export async function getViewedUserIdsByAdmin(adminUserId: number) {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select({ viewedUserId: adminUserViews.viewedUserId })
    .from(adminUserViews)
    .where(eq(adminUserViews.adminUserId, adminUserId));

  return rows.map(row => row.viewedUserId);
}

export async function markUserAsViewedByAdmin(adminUserId: number, viewedUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const payload: InsertAdminUserView = {
    adminUserId,
    viewedUserId,
    viewedAt: new Date(),
  };

  await db
    .insert(adminUserViews)
    .values(payload)
    .onConflictDoNothing({
      target: [adminUserViews.adminUserId, adminUserViews.viewedUserId],
    });
}

export async function markUsersAsViewedByAdmin(adminUserId: number, viewedUserIds: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (viewedUserIds.length === 0) return;

  const payloads: InsertAdminUserView[] = viewedUserIds.map(viewedUserId => ({
    adminUserId,
    viewedUserId,
    viewedAt: new Date(),
  }));

  await db
    .insert(adminUserViews)
    .values(payloads)
    .onConflictDoNothing({
      target: [adminUserViews.adminUserId, adminUserViews.viewedUserId],
    });
}

export async function hasNewPublicUsersForAdmin(adminUserId: number) {
  const db = await getDb();
  if (!db) return false;

  const publicUsers = await db
    .select({
      id: users.id,
    })
    .from(users)
    .where(and(eq(users.role, "cliente"), eq(users.registrationSource, "public_signup")));

  if (publicUsers.length === 0) {
    return false;
  }

  const viewedIds = new Set(await getViewedUserIdsByAdmin(adminUserId));
  return publicUsers.some(user => !viewedIds.has(user.id));
}

export async function updateUser(id: number, data: Partial<InsertUser>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set(data).where(eq(users.id, id));
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(2);

  if (result.length > 1) {
    throw new Error("Multiple users found for the same email");
  }

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByCpf(cpf: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.cpf, cpf)).limit(2);

  if (result.length > 1) {
    throw new Error("Multiple users found for the same cpf");
  }

  return result.length > 0 ? result[0] : undefined;
}

export async function getAllProperties() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(properties).orderBy(desc(properties.createdAt));
}

export async function getPropertyById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(properties)
    .where(eq(properties.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getPropertiesByCorretor(idCorretor: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(properties)
    .where(eq(properties.idCorretor, idCorretor))
    .orderBy(desc(properties.createdAt));
}

export async function getDestacados() {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(properties)
    .where(eq(properties.destaque, 1))
    .orderBy(desc(properties.createdAt))
    .limit(6);
}

export async function createProperty(data: InsertProperty) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(properties).values(data);
}

export async function updateProperty(id: number, data: Partial<InsertProperty>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(properties).set(data).where(eq(properties.id, id));
}

export async function deleteProperty(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(properties).where(eq(properties.id, id));
}

export async function getAllLeads() {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select({
      id: leads.id,
      nome: leads.nome,
      email: leads.email,
      cpf: leads.cpf,
      telefone: leads.telefone,
      status: leads.status,
      interesse: leads.interesse,
      observacao: leads.observacao,
      origem: leads.origem,
      userId: leads.userId,
      idResponsavel: leads.idResponsavel,
      idImovel: leads.idImovel,
      createdAt: leads.createdAt,
      updatedAt: leads.updatedAt,
    })
    .from(leads)
    .orderBy(desc(leads.createdAt));
}

export async function getLeadsByResponsavel(idResponsavel: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select({
      id: leads.id,
      nome: leads.nome,
      email: leads.email,
      cpf: leads.cpf,
      telefone: leads.telefone,
      status: leads.status,
      interesse: leads.interesse,
      observacao: leads.observacao,
      origem: leads.origem,
      userId: leads.userId,
      idResponsavel: leads.idResponsavel,
      idImovel: leads.idImovel,
      createdAt: leads.createdAt,
      updatedAt: leads.updatedAt,
    })
    .from(leads)
    .where(eq(leads.idResponsavel, idResponsavel))
    .orderBy(desc(leads.createdAt));
}

export async function getLeadById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getLeadsByCpf(cpf: string) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(leads).where(eq(leads.cpf, cpf)).orderBy(desc(leads.createdAt));
}

export async function getLeadsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(leads)
    .where(eq(leads.userId, userId))
    .orderBy(desc(leads.createdAt));
}

export async function linkLeadsToUserByCpf(cpf: string, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(leads)
    .set({
      cpf,
      userId,
      updatedAt: new Date(),
    })
    .where(eq(leads.cpf, cpf));
}

export async function unlinkLeadsFromUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(leads)
    .set({
      userId: null,
      updatedAt: new Date(),
    })
    .where(eq(leads.userId, userId));
}

export async function createLead(data: InsertLead) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.insert(leads).values({
    ...data,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export async function updateLead(id: number, data: Partial<InsertLead>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(leads).set(data).where(eq(leads.id, id));
}

export async function deleteLead(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(leads).where(eq(leads.id, id));
}

export async function deleteLeadsByUserId(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(leads).where(eq(leads.userId, userId));
}

export async function getLeadNotes(idLead: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(leadNotes)
    .where(eq(leadNotes.idLead, idLead))
    .orderBy(desc(leadNotes.createdAt));
}

export async function createLeadNote(data: InsertLeadNote) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.insert(leadNotes).values({
    ...data,
    createdAt: new Date(
      new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
    ),
  });
}

export async function getLeadFiles(idLead: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(leadFiles)
    .where(eq(leadFiles.idLead, idLead))
    .orderBy(desc(leadFiles.createdAt));
}

export async function createLeadFile(data: InsertLeadFile) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(leadFiles).values(data);
}

export async function getContractsByCliente(idCliente: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(contracts)
    .where(eq(contracts.idCliente, idCliente))
    .orderBy(desc(contracts.createdAt));
}

export async function getAllContracts() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(contracts).orderBy(desc(contracts.createdAt));
}

export async function createContract(data: InsertContract) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(contracts).values(data);
}

export async function getDocumentsByUsuario(idUsuario: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(documents)
    .where(eq(documents.idUsuario, idUsuario))
    .orderBy(desc(documents.createdAt));
}

export async function createDocument(data: InsertDocument) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(documents).values(data);
}

export async function updateDocument(id: number, data: Partial<InsertDocument>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(documents).set(data).where(eq(documents.id, id));
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(users).orderBy(desc(users.createdAt));
}

export async function updateUserRole(
  id: number,
  role: "cliente" | "corretor" | "administrativo"
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ role }).where(eq(users.id, id));
}

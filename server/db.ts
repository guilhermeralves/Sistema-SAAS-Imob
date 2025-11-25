import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, properties, leads, leadNotes, leadFiles, contracts, documents, InsertProperty, InsertLead, InsertLeadNote, InsertLeadFile, InsertContract, InsertDocument } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
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

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'administrativo';
      updateSet.role = 'administrativo';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ============= PROPERTIES QUERIES =============

import { desc, and, or, like, gte, lte } from "drizzle-orm";

export async function getAllProperties() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(properties).orderBy(desc(properties.createdAt));
}

export async function getPropertyById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(properties).where(eq(properties.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getPropertiesByCorretor(idCorretor: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(properties).where(eq(properties.idCorretor, idCorretor)).orderBy(desc(properties.createdAt));
}

export async function getDestacados() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(properties).where(eq(properties.destaque, 1)).orderBy(desc(properties.createdAt)).limit(6);
}

export async function createProperty(data: InsertProperty) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(properties).values(data);
  return result;
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

// ============= LEADS QUERIES =============

export async function getAllLeads() {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select({
    id: leads.id,
    nome: leads.nome,
    email: leads.email,
    telefone: leads.telefone,
    status: leads.status,
    interesse: leads.interesse,
    observacao: leads.observacao,
    origem: leads.origem,
    createdAt: leads.createdAt, // ← EXPLÍCITO
    updatedAt: leads.updatedAt,
  }).from(leads).orderBy(desc(leads.createdAt));
  
  return result;
}

export async function getLeadsByResponsavel(idResponsavel: number) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select({
    id: leads.id,
    nome: leads.nome,
    email: leads.email,
    telefone: leads.telefone,
    status: leads.status,
    interesse: leads.interesse,
    observacao: leads.observacao,
    origem: leads.origem,
    createdAt: leads.createdAt, // ← EXPLÍCITO
    updatedAt: leads.updatedAt,
  }).from(leads)
    .where(eq(leads.idResponsavel, idResponsavel))
    .orderBy(desc(leads.createdAt));
  
  return result;
}

export async function getLeadById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createLead(data: InsertLead) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
  );

  const result = await db.insert(leads).values({
    ...data,
    createdAt: now,
    updatedAt: now,
  });

  return result;
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

// ============= LEAD NOTES QUERIES =============

export async function getLeadNotes(idLead: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(leadNotes).where(eq(leadNotes.idLead, idLead)).orderBy(desc(leadNotes.createdAt));
}

export async function createLeadNote(data: InsertLeadNote) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
  );

  const result = await db.insert(leadNotes).values({
    ...data,
    createdAt: now,
  });

  return result;
}

// ============= LEAD FILES QUERIES =============

export async function getLeadFiles(idLead: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(leadFiles).where(eq(leadFiles.idLead, idLead)).orderBy(desc(leadFiles.createdAt));
}

export async function createLeadFile(data: InsertLeadFile) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(leadFiles).values(data);
  return result;
}

// ============= CONTRACTS QUERIES =============

export async function getContractsByCliente(idCliente: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(contracts).where(eq(contracts.idCliente, idCliente)).orderBy(desc(contracts.createdAt));
}

export async function getAllContracts() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(contracts).orderBy(desc(contracts.createdAt));
}

export async function createContract(data: InsertContract) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(contracts).values(data);
  return result;
}

// ============= DOCUMENTS QUERIES =============

export async function getDocumentsByUsuario(idUsuario: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(documents).where(eq(documents.idUsuario, idUsuario)).orderBy(desc(documents.createdAt));
}

export async function createDocument(data: InsertDocument) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(documents).values(data);
  return result;
}

export async function updateDocument(id: number, data: Partial<InsertDocument>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(documents).set(data).where(eq(documents.id, id));
}

// ============= USERS QUERIES =============

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(users).orderBy(desc(users.createdAt));
}

export async function updateUserRole(id: number, role: "cliente" | "corretor" | "administrativo") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ role }).where(eq(users.id, id));
}

import { and, desc, eq, inArray, isNull, lt, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import {
  adminUserViews,
  InsertContract,
  InsertAdminUserView,
  InsertCondominium,
  InsertDocument,
  InsertLead,
  InsertLeadFile,
  InsertLeadInteraction,
  InsertLeadNote,
  InsertPropertyDocument,
  InsertPropertyKeyStatusRequest,
  InsertPropertyOwner,
  InsertProperty,
  InsertTaskItem,
  InsertTaskItemAssignment,
  InsertTaskItemNote,
  InsertTaskItemTemplate,
  InsertUser,
  TaskItem,
  TaskItemTemplate,
  User,
  contracts,
  condominios,
  documents,
  leadFiles,
  leadInteractions,
  leadNotes,
  leads,
  taskItemAssignments,
  taskItemNotes,
  taskItemTemplates,
  taskItems,
  propertyDocuments,
  propertyKeyStatusRequests,
  propertyOwners,
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

export async function getPropertyOwnerById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(propertyOwners).where(eq(propertyOwners.id, id)).limit(1);
  return result[0];
}

export async function getPropertyOwnerByCpf(cpf: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(propertyOwners).where(eq(propertyOwners.cpf, cpf)).limit(2);

  if (result.length > 1) {
    throw new Error("Multiple property owners found for the same cpf");
  }

  return result[0];
}

export async function getPropertyOwnersByEmail(email: string) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(propertyOwners)
    .where(eq(propertyOwners.email, email))
    .orderBy(desc(propertyOwners.createdAt));
}

export async function createPropertyOwner(data: InsertPropertyOwner) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [createdOwner] = await db.insert(propertyOwners).values(data).returning();
  return createdOwner;
}

export async function updatePropertyOwner(id: number, data: Partial<InsertPropertyOwner>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [updatedOwner] = await db
    .update(propertyOwners)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(propertyOwners.id, id))
    .returning();

  return updatedOwner;
}

type ListCondominiumsOptions = {
  search?: string;
  tipo?: "casa" | "apartamento";
  includeInactive?: boolean;
  limit?: number;
};

function normalizeSearchTerm(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function buildCondominiumSearchText(item: {
  nome: string;
  cidade: string;
  estado: string;
  endereco: string;
  bairro: string | null;
  cep: string | null;
  referencia: string | null;
  administradoraNome: string | null;
  cnpj: string | null;
}) {
  return normalizeSearchTerm(
    [
      item.nome,
      item.cidade,
      item.estado,
      item.endereco,
      item.bairro ?? "",
      item.cep ?? "",
      item.referencia ?? "",
      item.administradoraNome ?? "",
      item.cnpj ?? "",
    ].join(" ")
  );
}

export async function listCondominiums(options?: ListCondominiumsOptions) {
  const db = await getDb();
  if (!db) return [];

  const rows = await db.select().from(condominios).orderBy(desc(condominios.createdAt));
  const normalizedSearch = options?.search ? normalizeSearchTerm(options.search) : "";
  const normalizedTerms = normalizedSearch.split(/\s+/).filter(Boolean);

  const filtered = rows.filter(item => {
    if (!options?.includeInactive && item.isAtivo !== 1) return false;
    if (options?.tipo && item.tipo !== options.tipo) return false;
    if (normalizedTerms.length === 0) return true;

    const searchableText = buildCondominiumSearchText(item);
    return normalizedTerms.every(term => searchableText.includes(term));
  });

  if (!options?.limit) return filtered;
  return filtered.slice(0, options.limit);
}

export async function getCondominiumById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const rows = await db.select().from(condominios).where(eq(condominios.id, id)).limit(1);
  return rows[0];
}

export async function createCondominium(data: InsertCondominium) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [created] = await db.insert(condominios).values(data).returning();
  return created;
}

export async function updateCondominium(id: number, data: Partial<InsertCondominium>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [updated] = await db
    .update(condominios)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(condominios.id, id))
    .returning();

  return updated;
}

export async function deleteCondominiumAndDetachProperties(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.transaction(async tx => {
    const detachedProperties = await tx
      .update(properties)
      .set({
        emCondominio: 0,
        tipoCondominio: null,
        idCondominio: null,
        updatedAt: new Date(),
      })
      .where(eq(properties.idCondominio, id))
      .returning({ id: properties.id });

    const [deletedCondominium] = await tx
      .delete(condominios)
      .where(eq(condominios.id, id))
      .returning({ id: condominios.id });

    return {
      deletedCondominiumId: deletedCondominium?.id ?? null,
      detachedPropertiesCount: detachedProperties.length,
    };
  });
}

export async function linkPropertyOwnersToUserByCpf(userId: number, cpf: string) {
  const db = await getDb();
  if (!db) return;

  await db
    .update(propertyOwners)
    .set({ userId, updatedAt: new Date() })
    .where(and(eq(propertyOwners.cpf, cpf), isNull(propertyOwners.userId)));
}

async function enrichPropertiesWithRelations(propertyRows: Array<any>) {
  const db = await getDb();
  if (!db || propertyRows.length === 0) return propertyRows;

  const ownerIds = Array.from(
    new Set(
      propertyRows
        .map(property => property.idProprietario)
        .filter((ownerId): ownerId is number => typeof ownerId === "number")
    )
  );
  const userIds = Array.from(
    new Set(propertyRows.flatMap(property => [property.idCorretor, property.createdByUserId]))
  );
  const condominiumIds = Array.from(
    new Set(
      propertyRows
        .map(property => property.idCondominio)
        .filter((condominiumId): condominiumId is number => typeof condominiumId === "number")
    )
  );

  const owners = ownerIds.length > 0
    ? await db.select().from(propertyOwners).where(inArray(propertyOwners.id, ownerIds))
    : [];
  const relatedUsers = userIds.length > 0
    ? await db.select().from(users).where(inArray(users.id, userIds))
    : [];
  const relatedCondominiums = condominiumIds.length > 0
    ? await db.select().from(condominios).where(inArray(condominios.id, condominiumIds))
    : [];

  const ownersById = new Map(owners.map(owner => [owner.id, owner]));
  const usersById = new Map(relatedUsers.map(user => [user.id, user]));
  const condominiumsById = new Map(relatedCondominiums.map(item => [item.id, item]));

  return propertyRows.map(property => ({
    ...property,
    proprietario: ownersById.get(property.idProprietario) ?? null,
    corretorResponsavel: usersById.get(property.idCorretor) ?? null,
    cadastradoPor: usersById.get(property.createdByUserId) ?? null,
    condominio: condominiumsById.get(property.idCondominio) ?? null,
  }));
}

export async function getAllProperties(options?: {
  deletedOnly?: boolean;
  includeDeleted?: boolean;
}) {
  const db = await getDb();
  if (!db) return [];

  if (options?.deletedOnly) {
    return await db
      .select()
      .from(properties)
      .where(eq(properties.lixeira, 1))
      .orderBy(desc(properties.createdAt));
  }

  if (options?.includeDeleted) {
    return await db.select().from(properties).orderBy(desc(properties.createdAt));
  }

  return await db
    .select()
    .from(properties)
    .where(eq(properties.lixeira, 0))
    .orderBy(desc(properties.createdAt));
}

export async function getPropertyById(id: number, options?: { includeDeleted?: boolean }) {
  const db = await getDb();
  if (!db) return undefined;

  const whereClause = options?.includeDeleted
    ? eq(properties.id, id)
    : and(eq(properties.id, id), eq(properties.lixeira, 0));

  const result = await db.select().from(properties).where(whereClause).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getPropertyByIdWithRelations(id: number, options?: { includeDeleted?: boolean }) {
  const property = await getPropertyById(id, options);
  if (!property) return undefined;

  const [enrichedProperty] = await enrichPropertiesWithRelations([property]);
  return enrichedProperty;
}

export async function getPropertiesByCorretor(idCorretor: number, options?: { deletedOnly?: boolean }) {
  const db = await getDb();
  if (!db) return [];

  const whereClause = options?.deletedOnly
    ? and(eq(properties.idCorretor, idCorretor), eq(properties.lixeira, 1))
    : and(eq(properties.idCorretor, idCorretor), eq(properties.lixeira, 0));

  const result = await db
    .select()
    .from(properties)
    .where(whereClause)
    .orderBy(desc(properties.createdAt));
  return await enrichPropertiesWithRelations(result);
}

export async function getAllPropertiesWithRelations(options?: {
  deletedOnly?: boolean;
  includeDeleted?: boolean;
}) {
  const db = await getDb();
  if (!db) return [];

  const result = options?.deletedOnly
    ? await db
        .select()
        .from(properties)
        .where(eq(properties.lixeira, 1))
        .orderBy(desc(properties.createdAt))
    : options?.includeDeleted
      ? await db.select().from(properties).orderBy(desc(properties.createdAt))
      : await db
          .select()
          .from(properties)
          .where(eq(properties.lixeira, 0))
          .orderBy(desc(properties.createdAt));

  return await enrichPropertiesWithRelations(result);
}

export async function getDestacados() {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(properties)
    .where(and(eq(properties.destaque, 1), eq(properties.lixeira, 0)))
    .orderBy(desc(properties.createdAt))
    .limit(6);
}

export async function createProperty(data: InsertProperty) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [created] = await db.insert(properties).values(data).returning();
  return created;
}

export async function updateProperty(id: number, data: Partial<InsertProperty>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(properties).set(data).where(eq(properties.id, id));
}

export async function updatePropertyKeyStatus(
  idImovel: number,
  data: {
    keyStatus: "disponivel" | "retirada" | "indisponivel";
    keyStatusObservation: string;
    keyStatusUpdatedByUserId: number | null;
    keyStatusUpdatedAt?: Date;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [updated] = await db
    .update(properties)
    .set({
      keyStatus: data.keyStatus,
      keyStatusObservation: data.keyStatusObservation,
      keyStatusUpdatedByUserId: data.keyStatusUpdatedByUserId,
      keyStatusUpdatedAt: data.keyStatusUpdatedAt ?? new Date(),
      updatedAt: new Date(),
    })
    .where(eq(properties.id, idImovel))
    .returning();

  return updated;
}

export async function getPropertyKeyStatusRequestsByPropertyId(idImovel: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(propertyKeyStatusRequests)
    .where(eq(propertyKeyStatusRequests.idImovel, idImovel))
    .orderBy(desc(propertyKeyStatusRequests.createdAt));
}

export async function getPropertyKeyStatusRequestById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const rows = await db
    .select()
    .from(propertyKeyStatusRequests)
    .where(eq(propertyKeyStatusRequests.id, id))
    .limit(1);

  return rows[0];
}

export async function createPropertyKeyStatusRequest(data: InsertPropertyKeyStatusRequest) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [created] = await db.insert(propertyKeyStatusRequests).values(data).returning();
  return created;
}

export async function updatePropertyKeyStatusRequest(
  id: number,
  data: Partial<InsertPropertyKeyStatusRequest>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [updated] = await db
    .update(propertyKeyStatusRequests)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(propertyKeyStatusRequests.id, id))
    .returning();

  return updated;
}

export async function deleteProperty(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(properties).where(eq(properties.id, id));
}

export async function softDeleteProperty(
  id: number,
  data: {
    motivoExclusao: string;
    excluidoPorUserId: number;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [updated] = await db
    .update(properties)
    .set({
      lixeira: 1,
      motivoExclusao: data.motivoExclusao,
      excluidoPorUserId: data.excluidoPorUserId,
      excluidoAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(properties.id, id))
    .returning();

  return updated;
}

export async function updatePropertyLegalDetails(
  id: number,
  data: Partial<
    Pick<
      InsertProperty,
      | "inscricaoImobiliaria"
      | "matriculaRegistro"
      | "cartorioRegistro"
      | "registroMunicipal"
      | "informacoesLegais"
      | "observacoesJuridicas"
    >
  >
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [updated] = await db
    .update(properties)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(properties.id, id))
    .returning();

  return updated;
}

export async function getAllLeads() {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select({
      id: leads.id,
      nome: leads.nome,
      email: leads.email,
      cpf: leads.cpf,
      birthDate: leads.birthDate,
      telefone: leads.telefone,
      status: leads.status,
      interesse: leads.interesse,
      observacao: leads.observacao,
      origem: leads.origem,
      userId: leads.userId,
      userBirthDate: users.birthDate,
      idResponsavel: leads.idResponsavel,
      idImovel: leads.idImovel,
      assignmentCycleStartedAt: leads.assignmentCycleStartedAt,
      assignedAt: leads.assignedAt,
      attendedAt: leads.attendedAt,
      assignmentSlaNotifiedAt: leads.assignmentSlaNotifiedAt,
      createdAt: leads.createdAt,
      updatedAt: leads.updatedAt,
    })
    .from(leads)
    .leftJoin(users, eq(leads.userId, users.id))
    .orderBy(desc(leads.createdAt));

  return await enrichLeadBirthDateByCpf(rows);
}

export async function getLeadsByResponsavel(idResponsavel: number) {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select({
      id: leads.id,
      nome: leads.nome,
      email: leads.email,
      cpf: leads.cpf,
      birthDate: leads.birthDate,
      telefone: leads.telefone,
      status: leads.status,
      interesse: leads.interesse,
      observacao: leads.observacao,
      origem: leads.origem,
      userId: leads.userId,
      userBirthDate: users.birthDate,
      idResponsavel: leads.idResponsavel,
      idImovel: leads.idImovel,
      assignmentCycleStartedAt: leads.assignmentCycleStartedAt,
      assignedAt: leads.assignedAt,
      attendedAt: leads.attendedAt,
      assignmentSlaNotifiedAt: leads.assignmentSlaNotifiedAt,
      createdAt: leads.createdAt,
      updatedAt: leads.updatedAt,
    })
    .from(leads)
    .leftJoin(users, eq(leads.userId, users.id))
    .where(eq(leads.idResponsavel, idResponsavel))
    .orderBy(desc(leads.createdAt));

  return await enrichLeadBirthDateByCpf(rows);
}

export async function getLeadById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select({
      id: leads.id,
      nome: leads.nome,
      email: leads.email,
      cpf: leads.cpf,
      birthDate: leads.birthDate,
      telefone: leads.telefone,
      status: leads.status,
      interesse: leads.interesse,
      observacao: leads.observacao,
      origem: leads.origem,
      userId: leads.userId,
      userBirthDate: users.birthDate,
      idResponsavel: leads.idResponsavel,
      idImovel: leads.idImovel,
      assignmentCycleStartedAt: leads.assignmentCycleStartedAt,
      assignedAt: leads.assignedAt,
      attendedAt: leads.attendedAt,
      assignmentSlaNotifiedAt: leads.assignmentSlaNotifiedAt,
      createdAt: leads.createdAt,
      updatedAt: leads.updatedAt,
    })
    .from(leads)
    .leftJoin(users, eq(leads.userId, users.id))
    .where(eq(leads.id, id))
    .limit(1);

  if (result.length === 0) {
    return undefined;
  }

  const [lead] = await enrichLeadBirthDateByCpf(result);
  return lead;
}

async function enrichLeadBirthDateByCpf<
  T extends {
    cpf: string | null;
    userBirthDate: Date | null;
  },
>(rows: T[]) {
  const db = await getDb();
  if (!db || rows.length === 0) {
    return rows;
  }

  const cpfsWithoutBirthDate = Array.from(
    new Set(
      rows
        .filter(row => !row.userBirthDate && typeof row.cpf === "string" && row.cpf.length > 0)
        .map(row => row.cpf as string)
    )
  );

  if (cpfsWithoutBirthDate.length === 0) {
    return rows;
  }

  const relatedUsers = await db
    .select({
      cpf: users.cpf,
      birthDate: users.birthDate,
    })
    .from(users)
    .where(inArray(users.cpf, cpfsWithoutBirthDate));

  const birthDateByCpf = new Map<string, Date | null>();
  for (const linkedUser of relatedUsers) {
    if (!linkedUser.cpf) continue;
    birthDateByCpf.set(linkedUser.cpf, linkedUser.birthDate ?? null);
  }

  return rows.map(row => {
    if (row.userBirthDate || !row.cpf) {
      return row;
    }

    const fallbackBirthDate = birthDateByCpf.get(row.cpf);
    if (!fallbackBirthDate) {
      return row;
    }

    return {
      ...row,
      userBirthDate: fallbackBirthDate,
    };
  });
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

  return await db
    .insert(leads)
    .values({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();
}

export async function updateLead(id: number, data: Partial<InsertLead>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(leads)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(leads.id, id));
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

export async function getLeadsForSlaProcessing() {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select({
      id: leads.id,
      status: leads.status,
      idResponsavel: leads.idResponsavel,
      assignmentCycleStartedAt: leads.assignmentCycleStartedAt,
      assignedAt: leads.assignedAt,
      attendedAt: leads.attendedAt,
      assignmentSlaNotifiedAt: leads.assignmentSlaNotifiedAt,
      createdAt: leads.createdAt,
    })
    .from(leads)
    .where(or(eq(leads.status, "novo"), eq(leads.status, "atendimento")));
}

export async function getLeadInteractions(idLead: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(leadInteractions)
    .where(eq(leadInteractions.idLead, idLead))
    .orderBy(desc(leadInteractions.createdAt), desc(leadInteractions.id));
}

export async function createLeadInteraction(data: InsertLeadInteraction) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.insert(leadInteractions).values({
    ...data,
    createdAt: new Date(),
  });
}

type TaskActor = Pick<User, "id" | "name" | "email" | "role" | "isActive">;

export type TaskItemWithRelations = TaskItem & {
  createdBy: TaskActor | null;
  assignees: TaskActor[];
};

export type TaskItemTemplateWithCreator = TaskItemTemplate & {
  createdBy: TaskActor | null;
};

async function enrichTaskItemsWithRelations(taskRows: TaskItem[]): Promise<TaskItemWithRelations[]> {
  const db = await getDb();
  if (!db || taskRows.length === 0) {
    return taskRows.map(task => ({
      ...task,
      createdBy: null,
      assignees: [],
    }));
  }

  const taskIds = taskRows.map(task => task.id);
  const assignmentRows =
    taskIds.length > 0
      ? await db
          .select()
          .from(taskItemAssignments)
          .where(inArray(taskItemAssignments.taskId, taskIds))
      : [];

  const userIds = Array.from(
    new Set([
      ...taskRows.map(task => task.createdByUserId),
      ...assignmentRows.map(assignment => assignment.userId),
    ])
  );

  const relatedUsers =
    userIds.length > 0
      ? await db.select().from(users).where(inArray(users.id, userIds))
      : [];

  const usersById = new Map<number, TaskActor>(
    relatedUsers.map(user => [
      user.id,
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
    ])
  );

  const assigneesByTask = new Map<number, TaskActor[]>();

  for (const assignment of assignmentRows) {
    const linkedUser = usersById.get(assignment.userId);
    if (!linkedUser) continue;

    const currentAssignees = assigneesByTask.get(assignment.taskId) ?? [];
    currentAssignees.push(linkedUser);
    assigneesByTask.set(assignment.taskId, currentAssignees);
  }

  return taskRows.map(task => ({
    ...task,
    createdBy: usersById.get(task.createdByUserId) ?? null,
    assignees: assigneesByTask.get(task.id) ?? [],
  }));
}

async function enrichTaskTemplatesWithCreator(
  templateRows: TaskItemTemplate[]
): Promise<TaskItemTemplateWithCreator[]> {
  const db = await getDb();
  if (!db || templateRows.length === 0) {
    return templateRows.map(template => ({
      ...template,
      createdBy: null,
    }));
  }

  const userIds = Array.from(new Set(templateRows.map(template => template.createdByUserId)));
  const relatedUsers =
    userIds.length > 0
      ? await db.select().from(users).where(inArray(users.id, userIds))
      : [];

  const usersById = new Map<number, TaskActor>(
    relatedUsers.map(user => [
      user.id,
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
    ])
  );

  return templateRows.map(template => ({
    ...template,
    createdBy: usersById.get(template.createdByUserId) ?? null,
  }));
}

export async function getUsersByIds(userIds: number[]) {
  const db = await getDb();
  if (!db || userIds.length === 0) return [];
  return await db.select().from(users).where(inArray(users.id, userIds));
}

export async function getAllTaskItemTemplatesWithCreator() {
  const db = await getDb();
  if (!db) return [];

  const rows = await db.select().from(taskItemTemplates).orderBy(desc(taskItemTemplates.updatedAt));
  return await enrichTaskTemplatesWithCreator(rows);
}

export async function getTaskItemTemplateById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const rows = await db.select().from(taskItemTemplates).where(eq(taskItemTemplates.id, id)).limit(1);
  return rows[0];
}

export async function createTaskItemTemplate(data: InsertTaskItemTemplate) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [created] = await db.insert(taskItemTemplates).values(data).returning();
  return created;
}

export async function updateTaskItemTemplate(id: number, data: Partial<InsertTaskItemTemplate>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [updated] = await db
    .update(taskItemTemplates)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(taskItemTemplates.id, id))
    .returning();

  return updated;
}

export async function deleteTaskItemTemplate(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(taskItemTemplates).where(eq(taskItemTemplates.id, id));
}

export async function getAllTaskItemsWithRelations() {
  const db = await getDb();
  if (!db) return [];

  const rows = await db.select().from(taskItems).orderBy(desc(taskItems.updatedAt));
  return await enrichTaskItemsWithRelations(rows);
}

export async function getTaskItemsForUserWithRelations(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const assignmentRows = await db
    .select({ taskId: taskItemAssignments.taskId })
    .from(taskItemAssignments)
    .where(eq(taskItemAssignments.userId, userId));

  const assignedTaskIds = assignmentRows.map(item => item.taskId);

  const rows =
    assignedTaskIds.length === 0
      ? await db
          .select()
          .from(taskItems)
          .where(eq(taskItems.createdByUserId, userId))
          .orderBy(desc(taskItems.updatedAt))
      : await db
          .select()
          .from(taskItems)
          .where(
            or(
              eq(taskItems.createdByUserId, userId),
              inArray(taskItems.id, assignedTaskIds)
            )
          )
          .orderBy(desc(taskItems.updatedAt));

  return await enrichTaskItemsWithRelations(rows);
}

export async function getTaskItemById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const rows = await db.select().from(taskItems).where(eq(taskItems.id, id)).limit(1);
  return rows[0];
}

export async function getTaskItemWithRelationsById(id: number) {
  const task = await getTaskItemById(id);
  if (!task) return undefined;

  const [enriched] = await enrichTaskItemsWithRelations([task]);
  return enriched;
}

export async function getTaskItemAssigneeIds(taskId: number) {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select({ userId: taskItemAssignments.userId })
    .from(taskItemAssignments)
    .where(eq(taskItemAssignments.taskId, taskId));

  return rows.map(row => row.userId);
}

export async function createTaskItem(data: InsertTaskItem) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [created] = await db.insert(taskItems).values(data).returning();
  return created;
}

export async function updateTaskItem(id: number, data: Partial<InsertTaskItem>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [updated] = await db
    .update(taskItems)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(taskItems.id, id))
    .returning();

  return updated;
}

export async function replaceTaskItemAssignees(taskId: number, userIds: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(taskItemAssignments).where(eq(taskItemAssignments.taskId, taskId));

  if (userIds.length === 0) return;

  const uniqueUserIds = Array.from(new Set(userIds));
  const rows: InsertTaskItemAssignment[] = uniqueUserIds.map(userId => ({
    taskId,
    userId,
    createdAt: new Date(),
  }));

  await db.insert(taskItemAssignments).values(rows);
}

export async function deleteTaskItem(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(taskItemAssignments).where(eq(taskItemAssignments.taskId, id));
  await db.delete(taskItemNotes).where(eq(taskItemNotes.taskId, id));
  await db.delete(taskItems).where(eq(taskItems.id, id));
}

export async function purgeCompletedTaskItemsOlderThan(days: number) {
  const db = await getDb();
  if (!db) return 0;
  if (!Number.isFinite(days) || days <= 0) return 0;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - Math.floor(days));

  const staleCompletedRows = await db
    .select({ id: taskItems.id })
    .from(taskItems)
    .where(
      and(
        eq(taskItems.status, "concluida"),
        lt(taskItems.updatedAt, cutoffDate)
      )
    );

  if (staleCompletedRows.length === 0) return 0;

  const staleTaskIds = staleCompletedRows.map(row => row.id);

  await db.delete(taskItemAssignments).where(inArray(taskItemAssignments.taskId, staleTaskIds));
  await db.delete(taskItemNotes).where(inArray(taskItemNotes.taskId, staleTaskIds));
  await db.delete(taskItems).where(inArray(taskItems.id, staleTaskIds));

  return staleTaskIds.length;
}

export async function getTaskItemNotes(taskId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(taskItemNotes)
    .where(eq(taskItemNotes.taskId, taskId))
    .orderBy(desc(taskItemNotes.createdAt));
}

export async function createTaskItemNote(data: InsertTaskItemNote) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [created] = await db.insert(taskItemNotes).values(data).returning();
  return created;
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

export async function getPropertyDocuments(idImovel: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(propertyDocuments)
    .where(eq(propertyDocuments.idImovel, idImovel))
    .orderBy(desc(propertyDocuments.createdAt));
}

export async function createPropertyDocument(data: InsertPropertyDocument) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(propertyDocuments).values(data);
}

export async function getPropertyDocumentById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(propertyDocuments).where(eq(propertyDocuments.id, id)).limit(1);
  return result[0];
}

export async function deletePropertyDocument(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(propertyDocuments).where(eq(propertyDocuments.id, id));
}

export async function updatePropertyDocumentName(id: number, nomeArquivo: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [updatedDocument] = await db
    .update(propertyDocuments)
    .set({
      nomeArquivo,
      updatedAt: new Date(),
    })
    .where(eq(propertyDocuments.id, id))
    .returning();

  return updatedDocument;
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

import { and, asc, desc, eq, inArray, isNull, lt, ne, notInArray, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import {
  adminUserViews,
  attendanceQueues,
  attendanceQueueMembers,
  attendanceQueueParticipants,
  InsertAttendanceQueue,
  InsertAttendanceQueueMember,
  InsertAttendanceQueueParticipant,
  InsertContract,
  InsertAdminUserView,
  InsertCondominium,
  InsertContractTemplate,
  InsertDocument,
  InsertIntegration,
  InsertLead,
  InsertLeadFile,
  InsertLeadInteraction,
  InsertLeadNote,
  InsertPropertyDocument,
  InsertPropertyKeyStatusRequest,
  InsertPropertyLaunch,
  InsertPropertyOwner,
  InsertProperty,
  InsertPushSubscription,
  InsertUserNotification,
  InsertTaskItem,
  InsertTaskItemAssignment,
  InsertTaskItemNote,
  InsertTaskItemTemplate,
  InsertUser,
  InsertRentalProposal,
  InsertRentalProposalBoleto,
  InsertRentalProposalGeneratedContract,
  InsertRentalProposalInsurance,
  InsertRentalProposalSignature,
  InsertRentalProposalUtilityTransfer,
  InsertRentalProposalInspection,
  TaskItem,
  TaskItemTemplate,
  User,
  contractTemplates,
  contracts,
  condominios,
  documents,
  integrations,
  leadFiles,
  leadInteractions,
  leadNotes,
  leads,
  rentalProposalBoletos,
  rentalProposalContractTemplates,
  rentalProposalGeneratedContracts,
  rentalProposalInsurances,
  rentalProposalSignatures,
  rentalProposalUtilityTransfers,
  rentalProposalInspections,
  rentalProposalOwners,
  rentalProposalTenants,
  rentalProposals,
  taskItemAssignments,
  taskItemNotes,
  taskItemTemplates,
  taskItemViews,
  taskItems,
  propertyDocuments,
  propertyKeyStatusRequests,
  propertyLaunches,
  propertyOwnerLinks,
  propertyOwners,
  properties,
  pushSubscriptions,
  storeProducts,
  storeSettings,
  userNotifications,
  users,
  walletBalances,
  walletTransactions,
  InsertStoreProduct,
  InsertWalletTransaction,
  StoreProduct,
  StoreSettings,
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

export async function markUserAsViewedByAdmin(
  adminUserId: number,
  viewedUserId: number
) {
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

export async function markUsersAsViewedByAdmin(
  adminUserId: number,
  viewedUserIds: number[]
) {
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
    .where(
      and(
        eq(users.role, "cliente"),
        eq(users.registrationSource, "public_signup")
      )
    );

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

  const result = await db
    .select()
    .from(users)
    .where(eq(users.cpf, cpf))
    .limit(2);

  if (result.length > 1) {
    throw new Error("Multiple users found for the same cpf");
  }

  return result.length > 0 ? result[0] : undefined;
}

export async function getPropertyOwnerById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(propertyOwners)
    .where(eq(propertyOwners.id, id))
    .limit(1);
  return result[0];
}

export async function getAllPropertyOwners() {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(propertyOwners)
    .orderBy(desc(propertyOwners.createdAt));
}

export async function getPropertyOwnerByCpf(cpf: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(propertyOwners)
    .where(eq(propertyOwners.cpf, cpf))
    .limit(2);

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

  const [createdOwner] = await db
    .insert(propertyOwners)
    .values(data)
    .returning();
  return createdOwner;
}

export async function updatePropertyOwner(
  id: number,
  data: Partial<InsertPropertyOwner>
) {
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

  const rows = await db
    .select()
    .from(condominios)
    .orderBy(desc(condominios.createdAt));
  const normalizedSearch = options?.search
    ? normalizeSearchTerm(options.search)
    : "";
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

  const rows = await db
    .select()
    .from(condominios)
    .where(eq(condominios.id, id))
    .limit(1);
  return rows[0];
}

export async function createCondominium(data: InsertCondominium) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [created] = await db.insert(condominios).values(data).returning();
  return created;
}

export async function updateCondominium(
  id: number,
  data: Partial<InsertCondominium>
) {
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

type ListIntegrationsOptions = {
  category?:
    | "portal_divulgacao"
    | "financeiro"
    | "assinaturas_eletronicas"
    | "automacao"
    | "outro";
  status?: "rascunho" | "ativo" | "inativo";
};

export async function listIntegrations(options?: ListIntegrationsOptions) {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select()
    .from(integrations)
    .orderBy(desc(integrations.updatedAt));

  return rows.filter(item => {
    if (options?.category && item.category !== options.category) return false;
    if (options?.status && item.status !== options.status) return false;
    return true;
  });
}

export async function getIntegrationById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const rows = await db
    .select()
    .from(integrations)
    .where(eq(integrations.id, id))
    .limit(1);
  return rows[0];
}

export async function createIntegration(data: InsertIntegration) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [created] = await db.insert(integrations).values(data).returning();
  return created;
}

export async function updateIntegration(
  id: number,
  data: Partial<InsertIntegration>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [updated] = await db
    .update(integrations)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(integrations.id, id))
    .returning();

  return updated;
}

export async function linkPropertyOwnersToUserByCpf(
  userId: number,
  cpf: string
) {
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

  const propertyIds = propertyRows.map(property => property.id);
  const ownerLinks = propertyIds.length
    ? await db
        .select()
        .from(propertyOwnerLinks)
        .where(inArray(propertyOwnerLinks.propertyId, propertyIds))
    : [];

  const ownerIds = Array.from(
    new Set(
      propertyRows
        .map(property => property.idProprietario)
        .concat(ownerLinks.map(link => link.ownerId))
        .filter((ownerId): ownerId is number => typeof ownerId === "number")
    )
  );
  const userIds = Array.from(
    new Set(
      propertyRows.flatMap(property => [
        property.idCorretor,
        property.createdByUserId,
      ])
    )
  );
  const condominiumIds = Array.from(
    new Set(
      propertyRows
        .map(property => property.idCondominio)
        .filter(
          (condominiumId): condominiumId is number =>
            typeof condominiumId === "number"
        )
    )
  );

  const owners =
    ownerIds.length > 0
      ? await db
          .select()
          .from(propertyOwners)
          .where(inArray(propertyOwners.id, ownerIds))
      : [];
  const relatedUsers =
    userIds.length > 0
      ? await db.select().from(users).where(inArray(users.id, userIds))
      : [];
  const relatedCondominiums =
    condominiumIds.length > 0
      ? await db
          .select()
          .from(condominios)
          .where(inArray(condominios.id, condominiumIds))
      : [];

  const ownersById = new Map(owners.map(owner => [owner.id, owner]));
  const usersById = new Map(relatedUsers.map(user => [user.id, user]));
  const condominiumsById = new Map(
    relatedCondominiums.map(item => [item.id, item])
  );
  const ownerLinksByPropertyId = new Map<number, typeof ownerLinks>();

  for (const link of ownerLinks) {
    const current = ownerLinksByPropertyId.get(link.propertyId) ?? [];
    current.push(link);
    ownerLinksByPropertyId.set(link.propertyId, current);
  }

  return propertyRows.map(property => ({
    ...property,
    proprietario: ownersById.get(property.idProprietario) ?? null,
    proprietarios: (ownerLinksByPropertyId.get(property.id) ?? [])
      .sort((a, b) => a.position - b.position)
      .flatMap(link => {
        const owner = ownersById.get(link.ownerId);
        return owner ? [owner] : [];
      }),
    corretorResponsavel: usersById.get(property.idCorretor) ?? null,
    cadastradoPor: usersById.get(property.createdByUserId) ?? null,
    condominio: condominiumsById.get(property.idCondominio) ?? null,
  }));
}

async function replacePropertyOwnerLinks(
  propertyId: number,
  ownerIds: number[]
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .delete(propertyOwnerLinks)
    .where(eq(propertyOwnerLinks.propertyId, propertyId));

  if (ownerIds.length === 0) return;

  await db.insert(propertyOwnerLinks).values(
    ownerIds.map((ownerId, index) => ({
      propertyId,
      ownerId,
      position: index + 1,
    }))
  );
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
    return await db
      .select()
      .from(properties)
      .orderBy(desc(properties.createdAt));
  }

  return await db
    .select()
    .from(properties)
    .where(eq(properties.lixeira, 0))
    .orderBy(desc(properties.createdAt));
}

export async function getPropertyById(
  id: number,
  options?: { includeDeleted?: boolean }
) {
  const db = await getDb();
  if (!db) return undefined;

  const whereClause = options?.includeDeleted
    ? eq(properties.id, id)
    : and(eq(properties.id, id), eq(properties.lixeira, 0));

  const result = await db.select().from(properties).where(whereClause).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getPropertyByIdWithRelations(
  id: number,
  options?: { includeDeleted?: boolean }
) {
  const property = await getPropertyById(id, options);
  if (!property) return undefined;

  const [enrichedProperty] = await enrichPropertiesWithRelations([property]);
  return enrichedProperty;
}

export async function getPropertiesByCorretor(
  idCorretor: number,
  options?: { deletedOnly?: boolean }
) {
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

function normalizePropertyCep(value: string | null | undefined) {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits || null;
}

function normalizePropertyNumber(value: string | null | undefined) {
  const normalized = (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase();

  return normalized || null;
}

export async function findActivePropertyByCepAndNumber(
  cep: string | null | undefined,
  numero: string | null | undefined,
  options?: { excludeId?: number }
) {
  const db = await getDb();
  if (!db) return undefined;

  const normalizedCep = normalizePropertyCep(cep);
  const normalizedNumber = normalizePropertyNumber(numero);

  if (!normalizedCep || !normalizedNumber) return undefined;

  const rows = await db
    .select()
    .from(properties)
    .where(eq(properties.lixeira, 0));

  return rows.find(property => {
    if (options?.excludeId && property.id === options.excludeId) return false;
    return (
      normalizePropertyCep(property.cep) === normalizedCep &&
      normalizePropertyNumber(property.numero) === normalizedNumber
    );
  });
}

export async function getActivePropertyLaunches() {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(propertyLaunches)
    .where(eq(propertyLaunches.isAtivo, 1))
    .orderBy(desc(propertyLaunches.destaque), desc(propertyLaunches.createdAt));
}

export async function createPropertyLaunch(data: InsertPropertyLaunch) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [created] = await db.insert(propertyLaunches).values(data).returning();
  return created;
}

export async function createProperty(
  data: InsertProperty,
  relations?: { ownerIds?: number[] }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [created] = await db.insert(properties).values(data).returning();
  await replacePropertyOwnerLinks(
    created.id,
    relations?.ownerIds ??
      (created.idProprietario ? [created.idProprietario] : [])
  );
  return created;
}

export async function updateProperty(
  id: number,
  data: Partial<InsertProperty>,
  relations?: { ownerIds?: number[] }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(properties).set(data).where(eq(properties.id, id));
  if (relations?.ownerIds) {
    await replacePropertyOwnerLinks(id, relations.ownerIds);
  }
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

export async function getPropertyKeyStatusRequestsByPropertyId(
  idImovel: number
) {
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

export async function createPropertyKeyStatusRequest(
  data: InsertPropertyKeyStatusRequest
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [created] = await db
    .insert(propertyKeyStatusRequests)
    .values(data)
    .returning();
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
        .filter(
          row =>
            !row.userBirthDate &&
            typeof row.cpf === "string" &&
            row.cpf.length > 0
        )
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

  return await db
    .select()
    .from(leads)
    .where(eq(leads.cpf, cpf))
    .orderBy(desc(leads.createdAt));
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
      nome: leads.nome,
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

async function enrichTaskItemsWithRelations(
  taskRows: TaskItem[]
): Promise<TaskItemWithRelations[]> {
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

  const userIds = Array.from(
    new Set(templateRows.map(template => template.createdByUserId))
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

  const rows = await db
    .select()
    .from(taskItemTemplates)
    .orderBy(desc(taskItemTemplates.updatedAt));
  return await enrichTaskTemplatesWithCreator(rows);
}

export async function getTaskItemTemplateById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const rows = await db
    .select()
    .from(taskItemTemplates)
    .where(eq(taskItemTemplates.id, id))
    .limit(1);
  return rows[0];
}

export async function createTaskItemTemplate(data: InsertTaskItemTemplate) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [created] = await db.insert(taskItemTemplates).values(data).returning();
  return created;
}

export async function updateTaskItemTemplate(
  id: number,
  data: Partial<InsertTaskItemTemplate>
) {
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

  const rows = await db
    .select()
    .from(taskItems)
    .orderBy(desc(taskItems.updatedAt));
  return await enrichTaskItemsWithRelations(rows);
}

// Marca uma tarefa/evento como visualizada por um usuario (idempotente).
export async function markTaskItemViewed(taskId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(taskItemViews)
    .values({ taskId, userId })
    .onConflictDoNothing();
}

// Retorna o conjunto de ids de tarefas/eventos ja vistos por um usuario.
export async function getViewedTaskIdsForUser(
  userId: number
): Promise<Set<number>> {
  const db = await getDb();
  if (!db) return new Set();
  const rows = await db
    .select({ taskId: taskItemViews.taskId })
    .from(taskItemViews)
    .where(eq(taskItemViews.userId, userId));
  return new Set(rows.map(row => row.taskId));
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

  const rows = await db
    .select()
    .from(taskItems)
    .where(eq(taskItems.id, id))
    .limit(1);
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

export async function updateTaskItem(
  id: number,
  data: Partial<InsertTaskItem>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [updated] = await db
    .update(taskItems)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(taskItems.id, id))
    .returning();

  return updated;
}

export async function replaceTaskItemAssignees(
  taskId: number,
  userIds: number[]
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .delete(taskItemAssignments)
    .where(eq(taskItemAssignments.taskId, taskId));

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

  await db
    .delete(taskItemAssignments)
    .where(eq(taskItemAssignments.taskId, id));
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

  await db
    .delete(taskItemAssignments)
    .where(inArray(taskItemAssignments.taskId, staleTaskIds));
  await db
    .delete(taskItemNotes)
    .where(inArray(taskItemNotes.taskId, staleTaskIds));
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

export async function getContractTemplates(contractKind?: "locacao" | "venda" | "outro") {
  const db = await getDb();
  if (!db) return [];
  const query = db
    .select()
    .from(contractTemplates)
    .orderBy(desc(contractTemplates.createdAt));

  if (!contractKind) return await query;

  return await db
    .select()
    .from(contractTemplates)
    .where(eq(contractTemplates.contractKind, contractKind))
    .orderBy(desc(contractTemplates.createdAt));
}

export async function getContractTemplateById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [template] = await db
    .select()
    .from(contractTemplates)
    .where(eq(contractTemplates.id, id))
    .limit(1);
  return template;
}

export async function createContractTemplate(data: InsertContractTemplate) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [created] = await db.insert(contractTemplates).values(data).returning();
  return created;
}

export async function updateContractTemplate(
  id: number,
  data: Partial<InsertContractTemplate>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [updated] = await db
    .update(contractTemplates)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(contractTemplates.id, id))
    .returning();
  return updated;
}

export async function deleteContractTemplate(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(rentalProposalContractTemplates)
    .where(eq(rentalProposalContractTemplates.contractTemplateId, id));
  await db
    .delete(rentalProposalGeneratedContracts)
    .where(eq(rentalProposalGeneratedContracts.contractTemplateId, id));
  await db.delete(contractTemplates).where(eq(contractTemplates.id, id));
}

export async function getRentalProposals() {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select()
    .from(rentalProposals)
    .where(ne(rentalProposals.status, "ativo"))
    .orderBy(desc(rentalProposals.createdAt));

  const proposalIds = rows.map(row => row.id);
  const propertyIds = Array.from(
    new Set(rows.map(row => row.propertyId).filter(Boolean))
  );

  const [tenantLinks, ownerLinks] = await Promise.all([
    proposalIds.length
      ? db
          .select()
          .from(rentalProposalTenants)
          .where(inArray(rentalProposalTenants.rentalProposalId, proposalIds))
      : Promise.resolve([]),
    proposalIds.length
      ? db
          .select()
          .from(rentalProposalOwners)
          .where(inArray(rentalProposalOwners.rentalProposalId, proposalIds))
      : Promise.resolve([]),
  ]);

  const userIds = Array.from(
    new Set(
      rows
        .flatMap(row => [row.brokerUserId, row.tenantUserId])
        .concat(tenantLinks.map(link => link.tenantUserId))
        .filter(Boolean)
    )
  );
  const ownerIds = Array.from(
    new Set(
      rows
        .map(row => row.ownerId)
        .concat(ownerLinks.map(link => link.ownerId))
        .filter((id): id is number => typeof id === "number")
    )
  );

  const [propertyRows, userRows, ownerRows] = await Promise.all([
    propertyIds.length
      ? db.select().from(properties).where(inArray(properties.id, propertyIds))
      : Promise.resolve([]),
    userIds.length
      ? db.select().from(users).where(inArray(users.id, userIds))
      : Promise.resolve([]),
    ownerIds.length
      ? db
          .select()
          .from(propertyOwners)
          .where(inArray(propertyOwners.id, ownerIds))
      : Promise.resolve([]),
  ]);

  const propertiesById = new Map(
    propertyRows.map(property => [property.id, property])
  );
  const usersById = new Map(userRows.map(user => [user.id, user]));
  const ownersById = new Map(ownerRows.map(owner => [owner.id, owner]));
  const tenantLinksByProposalId = new Map<number, typeof tenantLinks>();
  const ownerLinksByProposalId = new Map<number, typeof ownerLinks>();

  for (const link of tenantLinks) {
    const current = tenantLinksByProposalId.get(link.rentalProposalId) ?? [];
    current.push(link);
    tenantLinksByProposalId.set(link.rentalProposalId, current);
  }

  for (const link of ownerLinks) {
    const current = ownerLinksByProposalId.get(link.rentalProposalId) ?? [];
    current.push(link);
    ownerLinksByProposalId.set(link.rentalProposalId, current);
  }

  return rows.map(row => {
    const linkedTenants = (tenantLinksByProposalId.get(row.id) ?? [])
      .sort((a, b) => a.position - b.position)
      .map(link => usersById.get(link.tenantUserId))
      .filter((tenant): tenant is User => Boolean(tenant));
    const linkedOwners = (ownerLinksByProposalId.get(row.id) ?? [])
      .sort((a, b) => a.position - b.position)
      .map(link => ownersById.get(link.ownerId))
      .filter((owner): owner is NonNullable<typeof owner> => Boolean(owner));
    const fallbackTenant = usersById.get(row.tenantUserId);
    const fallbackOwner = row.ownerId ? ownersById.get(row.ownerId) : null;

    return {
      ...row,
      property: propertiesById.get(row.propertyId) ?? null,
      broker: usersById.get(row.brokerUserId) ?? null,
      tenant: usersById.get(row.tenantUserId) ?? null,
      tenants: linkedTenants.length
        ? linkedTenants
        : fallbackTenant
          ? [fallbackTenant]
          : [],
      owner: row.ownerId ? (ownersById.get(row.ownerId) ?? null) : null,
      owners: linkedOwners.length
        ? linkedOwners
        : fallbackOwner
          ? [fallbackOwner]
          : [],
    };
  });
}

export async function getPendingRentalProposalByProperty(propertyId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const [proposal] = await db
    .select({
      id: rentalProposals.id,
      status: rentalProposals.status,
      referenceCode: rentalProposals.referenceCode,
    })
    .from(rentalProposals)
    .where(
      and(
        eq(rentalProposals.propertyId, propertyId),
        notInArray(rentalProposals.status, ["ativo", "cancelado"])
      )
    )
    .orderBy(desc(rentalProposals.createdAt))
    .limit(1);

  return proposal;
}

export async function getRentalProposalById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const rows = await db
    .select()
    .from(rentalProposals)
    .where(eq(rentalProposals.id, id))
    .limit(1);

  if (rows.length === 0) return undefined;

  const [proposal] = rows;
  const [tenantLinks, ownerLinks] = await Promise.all([
    db
      .select()
      .from(rentalProposalTenants)
      .where(eq(rentalProposalTenants.rentalProposalId, proposal.id)),
    db
      .select()
      .from(rentalProposalOwners)
      .where(eq(rentalProposalOwners.rentalProposalId, proposal.id)),
  ]);

  const linkedTenantIds = tenantLinks
    .sort((a, b) => a.position - b.position)
    .map(link => link.tenantUserId);
  const linkedOwnerIds = ownerLinks
    .sort((a, b) => a.position - b.position)
    .map(link => link.ownerId);

  const tenantIds = linkedTenantIds.length
    ? linkedTenantIds
    : [proposal.tenantUserId];
  const ownerIds = linkedOwnerIds.length
    ? linkedOwnerIds
    : proposal.ownerId
      ? [proposal.ownerId]
      : [];

  const [property, broker, tenant, owner, tenantRows, ownerRows] =
    await Promise.all([
      getPropertyByIdWithRelations(proposal.propertyId),
      getUserById(proposal.brokerUserId),
      getUserById(proposal.tenantUserId),
      proposal.ownerId
        ? getPropertyOwnerById(proposal.ownerId)
        : Promise.resolve(undefined),
      tenantIds.length
        ? db.select().from(users).where(inArray(users.id, tenantIds))
        : Promise.resolve([]),
      ownerIds.length
        ? db
            .select()
            .from(propertyOwners)
            .where(inArray(propertyOwners.id, ownerIds))
        : Promise.resolve([]),
    ]);

  const tenantsById = new Map(tenantRows.map(item => [item.id, item]));
  const ownersById = new Map(ownerRows.map(item => [item.id, item]));

  return {
    ...proposal,
    property: property ?? null,
    broker: broker ?? null,
    tenant: tenant ?? null,
    tenants: tenantIds.flatMap(id => {
      const linkedTenant = tenantsById.get(id);
      return linkedTenant ? [linkedTenant] : [];
    }),
    owner: owner ?? null,
    owners: ownerIds.flatMap(id => {
      const linkedOwner = ownersById.get(id);
      return linkedOwner ? [linkedOwner] : [];
    }),
    contractTemplates: await getRentalProposalContractTemplates(id),
    generatedContracts: await getRentalProposalGeneratedContracts(id),
    boletos: await getRentalProposalBoletos(id),
    insurances: await getRentalProposalInsurances(id),
    signatures: await getRentalProposalSignatures(id),
    utilityTransfers: await getRentalProposalUtilityTransfers(id),
    inspection: await getRentalProposalInspection(id),
  };
}

export async function getRentalProposalContractTemplates(
  rentalProposalId: number
) {
  const db = await getDb();
  if (!db) return [];

  const links = await db
    .select()
    .from(rentalProposalContractTemplates)
    .where(
      eq(rentalProposalContractTemplates.rentalProposalId, rentalProposalId)
    );
  const templateIds = links
    .sort((a, b) => a.position - b.position)
    .map(link => link.contractTemplateId);

  if (templateIds.length === 0) return [];

  const templates = await db
    .select()
    .from(contractTemplates)
    .where(inArray(contractTemplates.id, templateIds));
  const templatesById = new Map(templates.map(template => [template.id, template]));

  return templateIds.flatMap(id => {
    const template = templatesById.get(id);
    return template ? [template] : [];
  });
}

async function replaceRentalProposalContractTemplates(
  rentalProposalId: number,
  contractTemplateIds: number[]
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .delete(rentalProposalContractTemplates)
    .where(
      eq(rentalProposalContractTemplates.rentalProposalId, rentalProposalId)
    );

  if (contractTemplateIds.length === 0) return;

  await db.insert(rentalProposalContractTemplates).values(
    contractTemplateIds.map((contractTemplateId, index) => ({
      rentalProposalId,
      contractTemplateId,
      position: index + 1,
    }))
  );
}

export async function updateRentalProposalContractTemplates(
  rentalProposalId: number,
  contractTemplateIds: number[]
) {
  await replaceRentalProposalContractTemplates(
    rentalProposalId,
    contractTemplateIds
  );
  return await getRentalProposalContractTemplates(rentalProposalId);
}

export async function getRentalProposalGeneratedContracts(
  rentalProposalId: number
) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(rentalProposalGeneratedContracts)
    .where(
      eq(rentalProposalGeneratedContracts.rentalProposalId, rentalProposalId)
    )
    .orderBy(rentalProposalGeneratedContracts.createdAt);
}

export async function getRentalProposalGeneratedContractById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const [contract] = await db
    .select()
    .from(rentalProposalGeneratedContracts)
    .where(eq(rentalProposalGeneratedContracts.id, id))
    .limit(1);

  return contract;
}

export async function updateRentalProposalGeneratedContractText(
  id: number,
  reviewedText: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [updated] = await db
    .update(rentalProposalGeneratedContracts)
    .set({ reviewedText, status: "em_revisao", updatedAt: new Date() })
    .where(eq(rentalProposalGeneratedContracts.id, id))
    .returning();

  return updated;
}

export async function regenerateRentalProposalGeneratedContract(
  id: number,
  fields: {
    title: string;
    generatedText: string;
    reviewedText: string;
    variableValues: string;
    unresolvedVariables: string;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [updated] = await db
    .update(rentalProposalGeneratedContracts)
    .set({
      ...fields,
      status: "em_revisao",
      approvedAt: null,
      approvedByUserId: null,
      updatedAt: new Date(),
    })
    .where(eq(rentalProposalGeneratedContracts.id, id))
    .returning();

  return updated;
}

export async function approveRentalProposalGeneratedContract(
  id: number,
  approvedByUserId: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [updated] = await db
    .update(rentalProposalGeneratedContracts)
    .set({
      status: "aprovado",
      approvedAt: new Date(),
      approvedByUserId,
      updatedAt: new Date(),
    })
    .where(eq(rentalProposalGeneratedContracts.id, id))
    .returning();

  return updated;
}

export async function setRentalProposalReferenceCode(
  proposalId: number,
  referenceCode: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [updated] = await db
    .update(rentalProposals)
    .set({
      referenceCode,
      status: "boletos_pendentes",
      currentStep: "boletos_pendentes",
      updatedAt: new Date(),
    })
    .where(eq(rentalProposals.id, proposalId))
    .returning();

  return updated;
}

export async function addRentalProposalGeneratedContracts(
  generatedContracts: InsertRentalProposalGeneratedContract[]
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (generatedContracts.length === 0) return [];

  return await db
    .insert(rentalProposalGeneratedContracts)
    .values(generatedContracts)
    .returning();
}

export async function deleteRentalProposalGeneratedContractsByTemplates(
  rentalProposalId: number,
  contractTemplateIds: number[]
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (contractTemplateIds.length === 0) return;

  await db
    .delete(rentalProposalGeneratedContracts)
    .where(
      and(
        eq(rentalProposalGeneratedContracts.rentalProposalId, rentalProposalId),
        inArray(
          rentalProposalGeneratedContracts.contractTemplateId,
          contractTemplateIds
        )
      )
    );
}

export async function deleteRentalProposalGeneratedContractById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .delete(rentalProposalGeneratedContracts)
    .where(eq(rentalProposalGeneratedContracts.id, id));
}

export async function getRentalProposalBoletos(rentalProposalId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(rentalProposalBoletos)
    .where(eq(rentalProposalBoletos.rentalProposalId, rentalProposalId))
    .orderBy(rentalProposalBoletos.installmentNumber);
}

export async function getRentalProposalBoletoById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const [boleto] = await db
    .select()
    .from(rentalProposalBoletos)
    .where(eq(rentalProposalBoletos.id, id))
    .limit(1);

  return boleto;
}

export async function insertRentalProposalBoletos(
  boletos: InsertRentalProposalBoleto[]
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (boletos.length === 0) return [];

  return await db.insert(rentalProposalBoletos).values(boletos).returning();
}

// Regera o cronograma do zero (so deve ser chamado quando nenhum boleto foi
// aprovado, validacao feita na camada de rota).
export async function replaceRentalProposalBoletos(
  rentalProposalId: number,
  boletos: InsertRentalProposalBoleto[]
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .delete(rentalProposalBoletos)
    .where(eq(rentalProposalBoletos.rentalProposalId, rentalProposalId));

  if (boletos.length === 0) return [];

  return await db.insert(rentalProposalBoletos).values(boletos).returning();
}

// Colunas dos seguros sem o `proofData` (base64 pode ser grande): a lista/agregado
// nao carrega o blob; o download usa getRentalProposalInsuranceByKind.
const rentalInsuranceListColumns = {
  id: rentalProposalInsurances.id,
  rentalProposalId: rentalProposalInsurances.rentalProposalId,
  kind: rentalProposalInsurances.kind,
  status: rentalProposalInsurances.status,
  insurer: rentalProposalInsurances.insurer,
  policyNumber: rentalProposalInsurances.policyNumber,
  amount: rentalProposalInsurances.amount,
  proofFileName: rentalProposalInsurances.proofFileName,
  proofContentType: rentalProposalInsurances.proofContentType,
  notes: rentalProposalInsurances.notes,
  requestedAt: rentalProposalInsurances.requestedAt,
  confirmedAt: rentalProposalInsurances.confirmedAt,
  confirmedByUserId: rentalProposalInsurances.confirmedByUserId,
  createdAt: rentalProposalInsurances.createdAt,
  updatedAt: rentalProposalInsurances.updatedAt,
};

export async function getRentalProposalInsurances(rentalProposalId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select(rentalInsuranceListColumns)
    .from(rentalProposalInsurances)
    .where(eq(rentalProposalInsurances.rentalProposalId, rentalProposalId))
    .orderBy(rentalProposalInsurances.kind);
}

export async function getRentalProposalInsuranceByKind(
  rentalProposalId: number,
  kind: "fianca" | "incendio"
) {
  const db = await getDb();
  if (!db) return undefined;

  const [row] = await db
    .select()
    .from(rentalProposalInsurances)
    .where(
      and(
        eq(rentalProposalInsurances.rentalProposalId, rentalProposalId),
        eq(rentalProposalInsurances.kind, kind)
      )
    )
    .limit(1);

  return row;
}

// Cria/atualiza o seguro de um tipo (chave unica proposta+tipo).
export async function upsertRentalProposalInsurance(
  rentalProposalId: number,
  kind: "fianca" | "incendio",
  data: Partial<
    Omit<
      InsertRentalProposalInsurance,
      "id" | "rentalProposalId" | "kind" | "createdAt"
    >
  >
) {
  const db = await getDb();
  if (!db) return null;

  const [existing] = await db
    .select({ id: rentalProposalInsurances.id })
    .from(rentalProposalInsurances)
    .where(
      and(
        eq(rentalProposalInsurances.rentalProposalId, rentalProposalId),
        eq(rentalProposalInsurances.kind, kind)
      )
    )
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(rentalProposalInsurances)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(rentalProposalInsurances.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(rentalProposalInsurances)
    .values({ rentalProposalId, kind, ...data })
    .returning();
  return created;
}

// Garante que ambos os seguros (fianca e incendio) existam como linhas pendentes.
export async function ensureRentalProposalInsurances(rentalProposalId: number) {
  for (const kind of ["fianca", "incendio"] as const) {
    const existing = await getRentalProposalInsuranceByKind(
      rentalProposalId,
      kind
    );
    if (!existing) {
      await upsertRentalProposalInsurance(rentalProposalId, kind, {});
    }
  }
  return await getRentalProposalInsurances(rentalProposalId);
}

// Colunas das assinaturas expostas em listagens (sem o PDF assinado em base64,
// que e pesado e baixado sob demanda por query dedicada).
const rentalSignatureListColumns = {
  id: rentalProposalSignatures.id,
  rentalProposalId: rentalProposalSignatures.rentalProposalId,
  generatedContractId: rentalProposalSignatures.generatedContractId,
  provider: rentalProposalSignatures.provider,
  environment: rentalProposalSignatures.environment,
  status: rentalProposalSignatures.status,
  externalDocumentUuid: rentalProposalSignatures.externalDocumentUuid,
  signersSnapshot: rentalProposalSignatures.signersSnapshot,
  signedFileName: rentalProposalSignatures.signedFileName,
  lastError: rentalProposalSignatures.lastError,
  sentAt: rentalProposalSignatures.sentAt,
  signedAt: rentalProposalSignatures.signedAt,
  sentByUserId: rentalProposalSignatures.sentByUserId,
  createdAt: rentalProposalSignatures.createdAt,
  updatedAt: rentalProposalSignatures.updatedAt,
} as const;

export async function getRentalProposalSignatures(rentalProposalId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select(rentalSignatureListColumns)
    .from(rentalProposalSignatures)
    .where(eq(rentalProposalSignatures.rentalProposalId, rentalProposalId))
    .orderBy(rentalProposalSignatures.generatedContractId);
}

export async function getRentalProposalSignatureById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const [row] = await db
    .select()
    .from(rentalProposalSignatures)
    .where(eq(rentalProposalSignatures.id, id))
    .limit(1);
  return row;
}

export async function getRentalProposalSignatureByContract(
  rentalProposalId: number,
  generatedContractId: number
) {
  const db = await getDb();
  if (!db) return undefined;

  const [row] = await db
    .select()
    .from(rentalProposalSignatures)
    .where(
      and(
        eq(rentalProposalSignatures.rentalProposalId, rentalProposalId),
        eq(rentalProposalSignatures.generatedContractId, generatedContractId)
      )
    )
    .limit(1);
  return row;
}

export async function getRentalProposalSignatureByExternalUuid(uuid: string) {
  const db = await getDb();
  if (!db) return undefined;

  const [row] = await db
    .select()
    .from(rentalProposalSignatures)
    .where(eq(rentalProposalSignatures.externalDocumentUuid, uuid))
    .limit(1);
  return row;
}

// Cria/atualiza a assinatura de um contrato (chave unica proposta+contrato).
export async function upsertRentalProposalSignature(
  rentalProposalId: number,
  generatedContractId: number,
  data: Partial<
    Omit<
      InsertRentalProposalSignature,
      "id" | "rentalProposalId" | "generatedContractId" | "createdAt"
    >
  >
) {
  const db = await getDb();
  if (!db) return null;

  const existing = await getRentalProposalSignatureByContract(
    rentalProposalId,
    generatedContractId
  );

  if (existing) {
    const [updated] = await db
      .update(rentalProposalSignatures)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(rentalProposalSignatures.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(rentalProposalSignatures)
    .values({ rentalProposalId, generatedContractId, ...data })
    .returning();
  return created;
}

// Garante uma linha de assinatura (status pendente) para cada contrato aprovado
// da proposta. Retorna a lista atualizada.
export async function ensureRentalProposalSignatures(rentalProposalId: number) {
  const contracts = await getRentalProposalGeneratedContracts(rentalProposalId);
  const approved = contracts.filter(item => item.status === "aprovado");

  for (const contract of approved) {
    const existing = await getRentalProposalSignatureByContract(
      rentalProposalId,
      contract.id
    );
    if (!existing) {
      await upsertRentalProposalSignature(rentalProposalId, contract.id, {});
    }
  }
  return await getRentalProposalSignatures(rentalProposalId);
}

// ---- Transferencia de titularidade de contas (energia/agua/gas) ----

const rentalUtilityTransferListColumns = {
  id: rentalProposalUtilityTransfers.id,
  rentalProposalId: rentalProposalUtilityTransfers.rentalProposalId,
  kind: rentalProposalUtilityTransfers.kind,
  label: rentalProposalUtilityTransfers.label,
  status: rentalProposalUtilityTransfers.status,
  proofFileName: rentalProposalUtilityTransfers.proofFileName,
  notes: rentalProposalUtilityTransfers.notes,
  requestedAt: rentalProposalUtilityTransfers.requestedAt,
  confirmedAt: rentalProposalUtilityTransfers.confirmedAt,
} as const;

// Contas padrao que sempre existem e nao podem ser removidas.
export const DEFAULT_UTILITY_TRANSFER_KINDS = ["energia", "agua", "gas"] as const;

export async function getRentalProposalUtilityTransfers(
  rentalProposalId: number
) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select(rentalUtilityTransferListColumns)
    .from(rentalProposalUtilityTransfers)
    .where(eq(rentalProposalUtilityTransfers.rentalProposalId, rentalProposalId))
    .orderBy(rentalProposalUtilityTransfers.kind);
}

export async function getRentalProposalUtilityTransferByKind(
  rentalProposalId: number,
  kind: string
) {
  const db = await getDb();
  if (!db) return undefined;

  const [row] = await db
    .select()
    .from(rentalProposalUtilityTransfers)
    .where(
      and(
        eq(rentalProposalUtilityTransfers.rentalProposalId, rentalProposalId),
        eq(rentalProposalUtilityTransfers.kind, kind)
      )
    )
    .limit(1);
  return row;
}

// Adiciona uma conta personalizada (slug gerado) com o rotulo informado.
export async function createCustomUtilityTransfer(
  rentalProposalId: number,
  label: string
) {
  const db = await getDb();
  if (!db) return null;

  const kind = `custom_${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;

  const [created] = await db
    .insert(rentalProposalUtilityTransfers)
    .values({ rentalProposalId, kind, label, status: "pendente" })
    .returning();
  return created;
}

export async function deleteRentalProposalUtilityTransfer(id: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(rentalProposalUtilityTransfers)
    .where(eq(rentalProposalUtilityTransfers.id, id));
}

export async function upsertRentalProposalUtilityTransfer(
  rentalProposalId: number,
  kind: string,
  data: Partial<
    Omit<
      InsertRentalProposalUtilityTransfer,
      "id" | "rentalProposalId" | "kind" | "createdAt"
    >
  >
) {
  const db = await getDb();
  if (!db) return null;

  const existing = await getRentalProposalUtilityTransferByKind(
    rentalProposalId,
    kind
  );

  if (existing) {
    const [updated] = await db
      .update(rentalProposalUtilityTransfers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(rentalProposalUtilityTransfers.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(rentalProposalUtilityTransfers)
    .values({ rentalProposalId, kind, ...data })
    .returning();
  return created;
}

// Garante uma linha pendente para cada conta (energia, agua, gas).
export async function ensureRentalProposalUtilityTransfers(
  rentalProposalId: number
) {
  for (const kind of ["energia", "agua", "gas"] as const) {
    const existing = await getRentalProposalUtilityTransferByKind(
      rentalProposalId,
      kind
    );
    if (!existing) {
      await upsertRentalProposalUtilityTransfer(rentalProposalId, kind, {});
    }
  }
  return await getRentalProposalUtilityTransfers(rentalProposalId);
}

// ---- Vistoria e laudo (etapas 27-28) ----

// Colunas da vistoria sem o laudo em base64 (baixado sob demanda).
const rentalInspectionColumns = {
  id: rentalProposalInspections.id,
  rentalProposalId: rentalProposalInspections.rentalProposalId,
  status: rentalProposalInspections.status,
  inspectorName: rentalProposalInspections.inspectorName,
  inspectorPhone: rentalProposalInspections.inspectorPhone,
  inspectorEmail: rentalProposalInspections.inspectorEmail,
  scheduledAt: rentalProposalInspections.scheduledAt,
  requestedAt: rentalProposalInspections.requestedAt,
  laudoFileName: rentalProposalInspections.laudoFileName,
  tenantValidatedAt: rentalProposalInspections.tenantValidatedAt,
  ownerValidatedAt: rentalProposalInspections.ownerValidatedAt,
  tenantValidatedByUserId: rentalProposalInspections.tenantValidatedByUserId,
  ownerValidatedByUserId: rentalProposalInspections.ownerValidatedByUserId,
  tenantValidationToken: rentalProposalInspections.tenantValidationToken,
  ownerValidationToken: rentalProposalInspections.ownerValidationToken,
  notes: rentalProposalInspections.notes,
} as const;

export async function getRentalProposalInspection(rentalProposalId: number) {
  const db = await getDb();
  if (!db) return null;

  const [row] = await db
    .select(rentalInspectionColumns)
    .from(rentalProposalInspections)
    .where(eq(rentalProposalInspections.rentalProposalId, rentalProposalId))
    .limit(1);
  return row ?? null;
}

export async function getRentalProposalInspectionLaudo(
  rentalProposalId: number
) {
  const db = await getDb();
  if (!db) return null;

  const [row] = await db
    .select({
      laudoData: rentalProposalInspections.laudoData,
      laudoFileName: rentalProposalInspections.laudoFileName,
      laudoContentType: rentalProposalInspections.laudoContentType,
    })
    .from(rentalProposalInspections)
    .where(eq(rentalProposalInspections.rentalProposalId, rentalProposalId))
    .limit(1);
  return row ?? null;
}

export async function upsertRentalProposalInspection(
  rentalProposalId: number,
  data: Partial<
    Omit<
      InsertRentalProposalInspection,
      "id" | "rentalProposalId" | "createdAt"
    >
  >
) {
  const db = await getDb();
  if (!db) return null;

  const [existing] = await db
    .select({ id: rentalProposalInspections.id })
    .from(rentalProposalInspections)
    .where(eq(rentalProposalInspections.rentalProposalId, rentalProposalId))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(rentalProposalInspections)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(rentalProposalInspections.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(rentalProposalInspections)
    .values({ rentalProposalId, ...data })
    .returning();
  return created;
}

function generateInspectionToken() {
  return `${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 12)}`;
}

// Garante o registro de vistoria e que ambos os tokens de validacao existam.
export async function ensureRentalProposalInspection(rentalProposalId: number) {
  const existing = await getRentalProposalInspection(rentalProposalId);
  if (!existing) {
    await upsertRentalProposalInspection(rentalProposalId, {
      tenantValidationToken: generateInspectionToken(),
      ownerValidationToken: generateInspectionToken(),
    });
  } else if (!existing.tenantValidationToken || !existing.ownerValidationToken) {
    await upsertRentalProposalInspection(rentalProposalId, {
      ...(existing.tenantValidationToken
        ? {}
        : { tenantValidationToken: generateInspectionToken() }),
      ...(existing.ownerValidationToken
        ? {}
        : { ownerValidationToken: generateInspectionToken() }),
    });
  }
  return await getRentalProposalInspection(rentalProposalId);
}

// Resolve um token de validacao -> registro completo + a parte (tenant/owner).
export async function getRentalProposalInspectionByToken(token: string) {
  const db = await getDb();
  if (!db) return null;

  const [row] = await db
    .select()
    .from(rentalProposalInspections)
    .where(
      or(
        eq(rentalProposalInspections.tenantValidationToken, token),
        eq(rentalProposalInspections.ownerValidationToken, token)
      )
    )
    .limit(1);

  if (!row) return null;
  const party: "tenant" | "owner" =
    row.tenantValidationToken === token ? "tenant" : "owner";
  return { inspection: row, party };
}

// Selfie de uma parte (data URL base64), baixada sob demanda.
export async function getRentalProposalInspectionSelfie(
  rentalProposalId: number,
  party: "tenant" | "owner"
) {
  const db = await getDb();
  if (!db) return null;

  const [row] = await db
    .select({
      tenantSelfieData: rentalProposalInspections.tenantSelfieData,
      ownerSelfieData: rentalProposalInspections.ownerSelfieData,
    })
    .from(rentalProposalInspections)
    .where(eq(rentalProposalInspections.rentalProposalId, rentalProposalId))
    .limit(1);
  if (!row) return null;
  return party === "tenant" ? row.tenantSelfieData : row.ownerSelfieData;
}

export async function updateRentalProposalBoleto(
  id: number,
  data: Partial<InsertRentalProposalBoleto>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [updated] = await db
    .update(rentalProposalBoletos)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(rentalProposalBoletos.id, id))
    .returning();

  return updated;
}

export async function approveRentalProposalBoleto(id: number, userId: number) {
  return await updateRentalProposalBoleto(id, {
    status: "aprovado",
    approvedAt: new Date(),
    approvedByUserId: userId,
  });
}

export async function approveAllRentalProposalBoletos(
  rentalProposalId: number,
  userId: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(rentalProposalBoletos)
    .set({
      status: "aprovado",
      approvedAt: new Date(),
      approvedByUserId: userId,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(rentalProposalBoletos.rentalProposalId, rentalProposalId),
        eq(rentalProposalBoletos.status, "pendente")
      )
    );

  return await getRentalProposalBoletos(rentalProposalId);
}

export async function markRentalProposalBoletoPaid(
  id: number,
  paidAt: Date | null
) {
  return await updateRentalProposalBoleto(id, { paidAt });
}

// Conjuntos de boletos (um por proposta que ja teve boletos gerados), com dados
// do imovel/locatario/corretor e a lista completa de parcelas para a sub-pagina
// de Boletos.
export async function getRentalProposalBoletoSets() {
  const db = await getDb();
  if (!db) return [];

  const boletos = await db
    .select()
    .from(rentalProposalBoletos)
    .orderBy(rentalProposalBoletos.installmentNumber);

  if (boletos.length === 0) return [];

  const boletosByProposal = new Map<number, typeof boletos>();
  for (const boleto of boletos) {
    const current = boletosByProposal.get(boleto.rentalProposalId) ?? [];
    current.push(boleto);
    boletosByProposal.set(boleto.rentalProposalId, current);
  }

  const proposalIds = Array.from(boletosByProposal.keys());
  const proposalRows = await db
    .select()
    .from(rentalProposals)
    .where(inArray(rentalProposals.id, proposalIds));

  const propertyIds = Array.from(
    new Set(proposalRows.map(row => row.propertyId).filter(Boolean))
  );
  const userIds = Array.from(
    new Set(
      proposalRows
        .flatMap(row => [row.brokerUserId, row.tenantUserId])
        .filter(Boolean)
    )
  );

  const [propertyRows, userRows] = await Promise.all([
    propertyIds.length
      ? db.select().from(properties).where(inArray(properties.id, propertyIds))
      : Promise.resolve([]),
    userIds.length
      ? db.select().from(users).where(inArray(users.id, userIds))
      : Promise.resolve([]),
  ]);

  const propertiesById = new Map(propertyRows.map(item => [item.id, item]));
  const usersById = new Map(userRows.map(item => [item.id, item]));

  return proposalRows
    .map(proposal => ({
      proposalId: proposal.id,
      referenceCode: proposal.referenceCode,
      status: proposal.status,
      currentStep: proposal.currentStep,
      createdAt: proposal.createdAt,
      property: propertiesById.get(proposal.propertyId) ?? null,
      broker: usersById.get(proposal.brokerUserId) ?? null,
      tenant: usersById.get(proposal.tenantUserId) ?? null,
      boletos: boletosByProposal.get(proposal.id) ?? [],
    }))
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
}

async function replaceRentalProposalTenants(
  rentalProposalId: number,
  tenantUserIds: number[]
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .delete(rentalProposalTenants)
    .where(eq(rentalProposalTenants.rentalProposalId, rentalProposalId));

  if (tenantUserIds.length === 0) return;

  await db.insert(rentalProposalTenants).values(
    tenantUserIds.map((tenantUserId, index) => ({
      rentalProposalId,
      tenantUserId,
      position: index + 1,
    }))
  );
}

async function replaceRentalProposalOwners(
  rentalProposalId: number,
  ownerIds: number[]
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .delete(rentalProposalOwners)
    .where(eq(rentalProposalOwners.rentalProposalId, rentalProposalId));

  if (ownerIds.length === 0) return;

  await db.insert(rentalProposalOwners).values(
    ownerIds.map((ownerId, index) => ({
      rentalProposalId,
      ownerId,
      position: index + 1,
    }))
  );
}

export async function createRentalProposal(
  data: InsertRentalProposal,
  relations?: { tenantUserIds?: number[]; ownerIds?: number[] }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [created] = await db.insert(rentalProposals).values(data).returning();
  await replaceRentalProposalTenants(
    created.id,
    relations?.tenantUserIds ?? [created.tenantUserId]
  );
  await replaceRentalProposalOwners(
    created.id,
    relations?.ownerIds ?? (created.ownerId ? [created.ownerId] : [])
  );
  return created;
}

export async function updateRentalProposal(
  id: number,
  data: Partial<InsertRentalProposal>,
  relations?: { tenantUserIds?: number[]; ownerIds?: number[] }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [updated] = await db
    .update(rentalProposals)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(rentalProposals.id, id))
    .returning();
  if (relations?.tenantUserIds) {
    await replaceRentalProposalTenants(id, relations.tenantUserIds);
  }
  if (relations?.ownerIds) {
    await replaceRentalProposalOwners(id, relations.ownerIds);
  }
  return updated;
}

export async function deleteRentalProposal(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(rentalProposalTenants)
    .where(eq(rentalProposalTenants.rentalProposalId, id));
  await db
    .delete(rentalProposalOwners)
    .where(eq(rentalProposalOwners.rentalProposalId, id));
  await db
    .delete(rentalProposalContractTemplates)
    .where(eq(rentalProposalContractTemplates.rentalProposalId, id));
  await db
    .delete(rentalProposalGeneratedContracts)
    .where(eq(rentalProposalGeneratedContracts.rentalProposalId, id));
  await db
    .delete(rentalProposalBoletos)
    .where(eq(rentalProposalBoletos.rentalProposalId, id));
  await db
    .delete(rentalProposalInsurances)
    .where(eq(rentalProposalInsurances.rentalProposalId, id));
  await db.delete(rentalProposals).where(eq(rentalProposals.id, id));
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

export async function updateDocument(
  id: number,
  data: Partial<InsertDocument>
) {
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
  const result = await db
    .select()
    .from(propertyDocuments)
    .where(eq(propertyDocuments.id, id))
    .limit(1);
  return result[0];
}

export async function deletePropertyDocument(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(propertyDocuments).where(eq(propertyDocuments.id, id));
}

export async function updatePropertyDocumentName(
  id: number,
  nomeArquivo: string
) {
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

export async function savePushSubscription(input: InsertPushSubscription) {
  const db = await getDb();
  if (!db) return null;

  const [existing] = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, input.endpoint))
    .limit(1);

  if (existing) {
    await db
      .update(pushSubscriptions)
      .set({
        userId: input.userId,
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: input.userAgent ?? null,
      })
      .where(eq(pushSubscriptions.endpoint, input.endpoint));
    return existing.id;
  }

  const [created] = await db
    .insert(pushSubscriptions)
    .values(input)
    .returning();
  return created?.id ?? null;
}

export async function getPushSubscriptionsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
}

export async function deletePushSubscriptionByEndpoint(endpoint: string) {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint));
}

export async function createUserNotification(input: InsertUserNotification) {
  const db = await getDb();
  if (!db) return null;
  const [created] = await db
    .insert(userNotifications)
    .values(input)
    .returning();
  return created ?? null;
}

export async function getUserNotifications(userId: number, limit = 30) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(userNotifications)
    .where(eq(userNotifications.userId, userId))
    .orderBy(desc(userNotifications.createdAt))
    .limit(limit);
}

export async function countUnreadUserNotifications(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .select()
    .from(userNotifications)
    .where(
      and(
        eq(userNotifications.userId, userId),
        eq(userNotifications.isRead, 0)
      )
    );
  return rows.length;
}

export async function markUserNotificationsRead(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(userNotifications)
    .set({ isRead: 1 })
    .where(
      and(
        eq(userNotifications.userId, userId),
        eq(userNotifications.isRead, 0)
      )
    );
}

export async function markUserNotificationRead(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(userNotifications)
    .set({ isRead: 1 })
    .where(
      and(eq(userNotifications.id, id), eq(userNotifications.userId, userId))
    );
}

/* ------------------------------------------------------------------ *
 * Roleta de Atendimentos — filas, permissões e participantes.
 * ------------------------------------------------------------------ */

export async function getAttendanceQueues() {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(attendanceQueues)
    .orderBy(desc(attendanceQueues.isDefault), asc(attendanceQueues.name));
}

export async function getActiveAttendanceQueues() {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(attendanceQueues)
    .where(eq(attendanceQueues.isActive, 1))
    .orderBy(desc(attendanceQueues.isDefault), asc(attendanceQueues.name));
}

export async function getAttendanceQueueById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(attendanceQueues)
    .where(eq(attendanceQueues.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function getDefaultAttendanceQueue() {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(attendanceQueues)
    .where(
      and(eq(attendanceQueues.isDefault, 1), eq(attendanceQueues.isActive, 1))
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function createAttendanceQueue(data: InsertAttendanceQueue) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Garante uma única fila padrão: se esta entra como padrão, zera as demais.
  if (data.isDefault) {
    await db
      .update(attendanceQueues)
      .set({ isDefault: 0, updatedAt: new Date() });
  }
  const rows = await db.insert(attendanceQueues).values(data).returning();
  return rows[0];
}

export async function updateAttendanceQueue(
  id: number,
  data: Partial<InsertAttendanceQueue>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (data.isDefault) {
    await db
      .update(attendanceQueues)
      .set({ isDefault: 0, updatedAt: new Date() })
      .where(ne(attendanceQueues.id, id));
  }
  const rows = await db
    .update(attendanceQueues)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(attendanceQueues.id, id))
    .returning();
  return rows[0] ?? null;
}

export async function deleteAttendanceQueue(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(attendanceQueueParticipants)
    .where(eq(attendanceQueueParticipants.queueId, id));
  await db
    .delete(attendanceQueueMembers)
    .where(eq(attendanceQueueMembers.queueId, id));
  await db.delete(attendanceQueues).where(eq(attendanceQueues.id, id));
}

export async function getAttendanceQueueMembers(queueId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(attendanceQueueMembers)
    .where(eq(attendanceQueueMembers.queueId, queueId));
}

/** Filas em que o corretor tem permissão de entrar (canJoin = 1). */
export async function getJoinableQueuesForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select({ queue: attendanceQueues })
    .from(attendanceQueueMembers)
    .innerJoin(
      attendanceQueues,
      eq(attendanceQueues.id, attendanceQueueMembers.queueId)
    )
    .where(
      and(
        eq(attendanceQueueMembers.userId, userId),
        eq(attendanceQueueMembers.canJoin, 1),
        eq(attendanceQueues.isActive, 1)
      )
    )
    .then(rows => rows.map(row => row.queue));
}

export async function getAttendanceQueueMember(queueId: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(attendanceQueueMembers)
    .where(
      and(
        eq(attendanceQueueMembers.queueId, queueId),
        eq(attendanceQueueMembers.userId, userId)
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

/** Concede/atualiza a permissão de um corretor numa fila (upsert por par). */
export async function setAttendanceQueueMember(input: {
  queueId: number;
  userId: number;
  canJoin: boolean;
  createdByUserId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getAttendanceQueueMember(input.queueId, input.userId);
  if (existing) {
    const rows = await db
      .update(attendanceQueueMembers)
      .set({ canJoin: input.canJoin ? 1 : 0, updatedAt: new Date() })
      .where(eq(attendanceQueueMembers.id, existing.id))
      .returning();
    return rows[0];
  }
  const values: InsertAttendanceQueueMember = {
    queueId: input.queueId,
    userId: input.userId,
    canJoin: input.canJoin ? 1 : 0,
    createdByUserId: input.createdByUserId,
  };
  const rows = await db
    .insert(attendanceQueueMembers)
    .values(values)
    .returning();
  return rows[0];
}

export async function removeAttendanceQueueMember(
  queueId: number,
  userId: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(attendanceQueueMembers)
    .where(
      and(
        eq(attendanceQueueMembers.queueId, queueId),
        eq(attendanceQueueMembers.userId, userId)
      )
    );
  // Ao perder a permissão, também sai da fila ativa.
  await db
    .delete(attendanceQueueParticipants)
    .where(
      and(
        eq(attendanceQueueParticipants.queueId, queueId),
        eq(attendanceQueueParticipants.userId, userId)
      )
    );
}

/** Participantes ativos da fila, ordenados pela posição do rodízio. */
export async function getAttendanceQueueParticipants(queueId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(attendanceQueueParticipants)
    .where(
      and(
        eq(attendanceQueueParticipants.queueId, queueId),
        eq(attendanceQueueParticipants.isActive, 1)
      )
    )
    .orderBy(asc(attendanceQueueParticipants.position));
}

export async function getAttendanceQueueParticipant(
  queueId: number,
  userId: number
) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(attendanceQueueParticipants)
    .where(
      and(
        eq(attendanceQueueParticipants.queueId, queueId),
        eq(attendanceQueueParticipants.userId, userId)
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

/** Participações ativas do corretor (em quais filas ele está agora). */
export async function getActiveParticipationsForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(attendanceQueueParticipants)
    .where(
      and(
        eq(attendanceQueueParticipants.userId, userId),
        eq(attendanceQueueParticipants.isActive, 1)
      )
    );
}

/**
 * Coloca o corretor no fim da fila (maior position + 1). Se já existir registro
 * (inclusive inativo por ter saído antes), reativa e reposiciona no fim.
 */
export async function joinAttendanceQueue(queueId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const active = await getAttendanceQueueParticipants(queueId);
  const nextPosition =
    active.reduce((max, row) => Math.max(max, row.position), 0) + 1;

  const existing = await getAttendanceQueueParticipant(queueId, userId);
  if (existing) {
    const rows = await db
      .update(attendanceQueueParticipants)
      .set({
        isActive: 1,
        position: existing.isActive ? existing.position : nextPosition,
        joinedAt: existing.isActive ? existing.joinedAt : new Date(),
        leftAt: null,
        updatedAt: new Date(),
      })
      .where(eq(attendanceQueueParticipants.id, existing.id))
      .returning();
    return rows[0];
  }

  const values: InsertAttendanceQueueParticipant = {
    queueId,
    userId,
    position: nextPosition,
    isActive: 1,
  };
  const rows = await db
    .insert(attendanceQueueParticipants)
    .values(values)
    .returning();
  return rows[0];
}

/** Marca o corretor como fora da fila, preservando o histórico. */
export async function leaveAttendanceQueue(queueId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(attendanceQueueParticipants)
    .set({ isActive: 0, leftAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(attendanceQueueParticipants.queueId, queueId),
        eq(attendanceQueueParticipants.userId, userId)
      )
    );
}

/**
 * Envia o corretor para o fim da fila (maior position + 1) e registra o
 * `lastAssignedAt`. Usado no round-robin após ele receber um lead.
 */
export async function rotateAttendanceQueueParticipantToBack(
  queueId: number,
  userId: number
) {
  const db = await getDb();
  if (!db) return;
  const active = await getAttendanceQueueParticipants(queueId);
  const maxPosition = active.reduce((max, row) => Math.max(max, row.position), 0);
  await db
    .update(attendanceQueueParticipants)
    .set({
      position: maxPosition + 1,
      lastAssignedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(attendanceQueueParticipants.queueId, queueId),
        eq(attendanceQueueParticipants.userId, userId)
      )
    );
}

/* ============================================================================
 * Loja & Carteira — helpers
 * ============================================================================ */

export async function getWalletBalance(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const [row] = await db
    .select({ tokens: walletBalances.tokens })
    .from(walletBalances)
    .where(eq(walletBalances.userId, userId))
    .limit(1);
  return row?.tokens ?? 0;
}

export async function getWalletTransactions(
  userId: number,
  limit = 50
) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(walletTransactions)
    .where(eq(walletTransactions.userId, userId))
    .orderBy(desc(walletTransactions.createdAt))
    .limit(limit);
}

/**
 * Aplica crédito ou débito atomicamente:
 *  - upsert em walletBalances (soma/subtrai)
 *  - insere linha em walletTransactions
 * Lança erro se debit resultar em saldo negativo.
 */
export async function applyWalletTransaction(input: {
  userId: number;
  type: "credit" | "debit";
  amount: number;
  reason: InsertWalletTransaction["reason"];
  description?: string | null;
  referenceType?: string | null;
  referenceId?: number | null;
  createdByUserId?: number | null;
}): Promise<{ balance: number; transactionId: number }> {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new Error("amount deve ser inteiro positivo");
  }
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.transaction(async tx => {
    const [existing] = await tx
      .select()
      .from(walletBalances)
      .where(eq(walletBalances.userId, input.userId))
      .limit(1);

    const currentBalance = existing?.tokens ?? 0;
    const delta = input.type === "credit" ? input.amount : -input.amount;
    const newBalance = currentBalance + delta;

    if (newBalance < 0) {
      throw new Error("saldo insuficiente");
    }

    if (existing) {
      await tx
        .update(walletBalances)
        .set({ tokens: newBalance, updatedAt: new Date() })
        .where(eq(walletBalances.userId, input.userId));
    } else {
      await tx
        .insert(walletBalances)
        .values({ userId: input.userId, tokens: newBalance });
    }

    const [inserted] = await tx
      .insert(walletTransactions)
      .values({
        userId: input.userId,
        type: input.type,
        amount: input.amount,
        reason: input.reason,
        description: input.description ?? null,
        referenceType: input.referenceType ?? null,
        referenceId: input.referenceId ?? null,
        createdByUserId: input.createdByUserId ?? null,
      })
      .returning({ id: walletTransactions.id });

    return { balance: newBalance, transactionId: inserted.id };
  });
}

export async function getStoreSettings(): Promise<StoreSettings | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(storeSettings).limit(1);
  return row ?? null;
}

export async function updateStoreSettings(
  data: Partial<Omit<StoreSettings, "id" | "updatedAt">>
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [existing] = await db.select().from(storeSettings).limit(1);
  if (existing) {
    await db
      .update(storeSettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(storeSettings.id, existing.id));
  } else {
    await db.insert(storeSettings).values({ ...data });
  }
}

/* ========================================================================
 * Loja — produtos
 * ======================================================================== */

export async function listStoreProducts(opts: { onlyActive?: boolean } = {}) {
  const db = await getDb();
  if (!db) return [];
  const rows = opts.onlyActive
    ? await db
        .select()
        .from(storeProducts)
        .where(eq(storeProducts.isActive, 1))
        .orderBy(desc(storeProducts.createdAt))
    : await db
        .select()
        .from(storeProducts)
        .orderBy(desc(storeProducts.createdAt));
  return rows;
}

export async function getStoreProductById(id: number): Promise<StoreProduct | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const [row] = await db
    .select()
    .from(storeProducts)
    .where(eq(storeProducts.id, id))
    .limit(1);
  return row;
}

export async function createStoreProduct(data: InsertStoreProduct): Promise<StoreProduct> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db
    .insert(storeProducts)
    .values({ ...data, createdAt: new Date(), updatedAt: new Date() })
    .returning();
  return row;
}

export async function updateStoreProduct(
  id: number,
  data: Partial<InsertStoreProduct>
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(storeProducts)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(storeProducts.id, id));
}

export async function deleteStoreProduct(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(storeProducts).where(eq(storeProducts.id, id));
}

import { APP_ROLES } from "@shared/auth";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import {
  CONTRACT_REQUIRED_USER_FIELDS,
  USER_PROFILE_MARITAL_STATUSES,
} from "@shared/user-profile";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { normalizeCpf, isValidCpf } from "./_core/cpf";
import { formatCreci, isValidCreci, normalizeCreci } from "./_core/creci";
import { getSessionCookieOptions } from "./_core/cookies";
import { sendWelcomeEmail } from "./_core/email";
import { ENV } from "./_core/env";
import { hashPassword, verifyPassword } from "./_core/passwords";
import { sdk } from "./_core/sdk";
import { systemRouter } from "./_core/systemRouter";
import {
  adminProcedure,
  clientProcedure,
  publicProcedure,
  protectedProcedure,
  router,
  staffProcedure,
} from "./_core/trpc";
import { toSafeUser } from "./_core/users";

const idSchema = z.object({
  id: z.number().int().positive(),
});

const cpfSchema = z
  .string()
  .trim()
  .refine(isValidCpf, "CPF inválido")
  .transform(normalizeCpf);

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(72),
  name: z.string().trim().min(2).max(120),
  cpf: cpfSchema,
  phone: z.string().trim().min(14).max(20),
  birthDate: z.string().nullable().optional(),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(72),
});

const creciSchema = z
  .string()
  .trim()
  .transform(formatCreci)
  .refine(value => value === "" || isValidCreci(value), "CRECI invalido");

const adminCreateUserSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(72),
  name: z.string().trim().min(2).max(120),
  cpf: cpfSchema,
  creci: creciSchema.optional(),
  role: z.enum(APP_ROLES),
});

const adminUpdateUserSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(2).max(120).optional(),
  role: z.enum(APP_ROLES).optional(),
  password: z.string().min(8).max(72).optional(),
  isActive: z.number().int().min(0).max(1).optional(),
});

const adminUserDetailsSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  cpf: cpfSchema,
  role: z.enum(APP_ROLES),
  isActive: z.number().int().min(0).max(1),
  phone: z.string().trim().max(20).optional(),
  creci: creciSchema.optional(),
  birthDate: z.string().nullable().optional(),
  profession: z.string().trim().max(120).optional(),
  grossMonthlyIncome: z.number().int().min(0).nullable().optional(),
  maritalStatus: z.enum(USER_PROFILE_MARITAL_STATUSES).nullable().optional(),
  householdIncome: z.number().int().min(0).nullable().optional(),
  rg: z.string().trim().max(32).optional(),
  nationality: z.string().trim().max(80).optional(),
  address: z.string().trim().max(255).optional(),
  neighborhood: z.string().trim().max(100).optional(),
  addressNumber: z.string().trim().max(20).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(2).optional(),
  zipCode: z.string().trim().max(10).optional(),
  notes: z.string().trim().max(2000).optional(),
});

const profileDetailsSchema = adminUserDetailsSchema.omit({
  id: true,
  role: true,
  isActive: true,
});

const assignLeadSchema = z.object({
  leadId: z.number().int().positive(),
  userId: z.number().int().positive().nullable(),
});

const adminLeadLinkPreviewSchema = z.object({
  cpf: cpfSchema,
});

const adminDeleteUserPreviewSchema = z.object({
  userId: z.number().int().positive(),
});

const adminDeleteUserSchema = z.object({
  userId: z.number().int().positive(),
  deleteLinkedLeads: z.boolean().default(false),
});

const adminValidateCreciSchema = z.object({
  userId: z.number().int().positive(),
});

const propertyDocumentsSchema = z.object({
  idImovel: z.number().int().positive(),
});

const createPropertyDocumentSchema = z.object({
  idImovel: z.number().int().positive(),
  nomeArquivo: z.string().trim().min(1).max(255),
  urlArquivo: z.string().trim().min(1),
  tipoArquivo: z.string().trim().min(1).max(120),
});

const deletePropertyDocumentSchema = z.object({
  id: z.number().int().positive(),
});

const renamePropertyDocumentSchema = z.object({
  id: z.number().int().positive(),
  nomeArquivo: z.string().trim().min(1).max(255),
});

const propertyPhotoUploadSchema = z.object({
  fileName: z.string().trim().max(255).optional(),
  dataUrl: z.string().trim().min(1).max(30_000_000),
});

const propertyUploadedPhotoDeleteSchema = z.object({
  url: z.string().trim().min(1).max(500),
});

const propertyOwnerInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  cpf: cpfSchema,
  phone: z.string().trim().min(14).max(20),
  notes: z.string().trim().max(2000).optional(),
});

const condominiumTypeSchema = z.enum(["casa", "apartamento"]);

const propertyMutationSchema = z.object({
  titulo: z.string().trim().min(2).max(255),
  descricao: z.string().trim().max(5000).nullable().optional(),
  tipo: z.string().trim().min(2).max(50),
  finalidade: z.string().trim().min(2).max(20),
  valor: z.number().int().min(0),
  valorLocacao: z.number().int().min(0).nullable().optional(),
  area: z.number().int().min(0).nullable().optional(),
  quartos: z.number().int().min(0).nullable().optional(),
  banheiros: z.number().int().min(0).nullable().optional(),
  vagas: z.number().int().min(0).nullable().optional(),
  endereco: z.string().trim().min(2).max(255),
  numero: z.string().trim().max(20).nullable().optional(),
  bairro: z.string().trim().max(100).nullable().optional(),
  cidade: z.string().trim().min(2).max(100),
  estado: z.string().trim().min(2).max(2),
  cep: z.string().trim().max(10).nullable().optional(),
  latitude: z.string().trim().max(20).nullable().optional(),
  longitude: z.string().trim().max(20).nullable().optional(),
  fotos: z.string().trim().nullable().optional(),
  destaque: z.number().int().min(0).max(1).optional(),
  status: z.string().trim().max(20).optional(),
  idCorretor: z.number().int().positive().optional(),
  emCondominio: z.boolean().optional(),
  tipoCondominio: condominiumTypeSchema.nullable().optional(),
  idCondominio: z.number().int().positive().nullable().optional(),
  owner: propertyOwnerInputSchema,
  confirmedOwnerEmailConflict: z.boolean().optional(),
});

const propertyListSchema = z.object({
  showDeletedOnly: z.boolean().optional(),
});

const condominiumMutationSchema = z.object({
  nome: z.string().trim().min(2).max(180),
  tipo: condominiumTypeSchema,
  endereco: z.string().trim().min(2).max(255),
  numero: z.string().trim().max(20).nullable().optional(),
  complemento: z.string().trim().max(120).nullable().optional(),
  bairro: z.string().trim().max(100).nullable().optional(),
  cidade: z.string().trim().min(2).max(100),
  estado: z.string().trim().min(2).max(2),
  cep: z.string().trim().max(10).nullable().optional(),
  referencia: z.string().trim().max(2000).nullable().optional(),
  valorCondominio: z.number().int().min(0).nullable().optional(),
  valorIptu: z.number().int().min(0).nullable().optional(),
  cnpj: z.string().trim().max(18).nullable().optional(),
  administradoraNome: z.string().trim().max(120).nullable().optional(),
  administradoraContato: z.string().trim().max(120).nullable().optional(),
  caracteristicas: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
  observacoes: z.string().trim().max(5000).nullable().optional(),
});

const listCondominiumsSchema = z.object({
  search: z.string().trim().max(120).optional(),
  tipo: condominiumTypeSchema.optional(),
  includeInactive: z.boolean().optional(),
  limit: z.number().int().min(1).max(300).optional(),
});

const createCondominiumSchema = condominiumMutationSchema;

const updateCondominiumSchema = condominiumMutationSchema.extend({
  id: z.number().int().positive(),
});

const updateCondominiumStatusSchema = z.object({
  id: z.number().int().positive(),
  isAtivo: z.number().int().min(0).max(1),
});

const deleteCondominiumSchema = z.object({
  id: z.number().int().positive(),
});

const createPropertySchema = propertyMutationSchema;

const updatePropertySchema = propertyMutationSchema.extend({
  id: z.number().int().positive(),
});

const deletePropertySchema = z.object({
  id: z.number().int().positive(),
  confirmationText: z.string().trim(),
  motivoExclusao: z.string().trim().min(3).max(2000),
});

const updatePropertyLegalDetailsSchema = z.object({
  id: z.number().int().positive(),
  inscricaoImobiliaria: z.string().trim().max(120).optional().nullable(),
  matriculaRegistro: z.string().trim().max(120).optional().nullable(),
  cartorioRegistro: z.string().trim().max(160).optional().nullable(),
  registroMunicipal: z.string().trim().max(120).optional().nullable(),
  informacoesLegais: z.string().trim().max(4000).optional().nullable(),
  observacoesJuridicas: z.string().trim().max(4000).optional().nullable(),
});

const propertyKeyStatusSchema = z.enum(["disponivel", "retirada", "indisponivel"]);

const propertyKeyStatusRequestsListSchema = z.object({
  idImovel: z.number().int().positive(),
});

const requestPropertyKeyStatusChangeSchema = z.object({
  idImovel: z.number().int().positive(),
  requestedStatus: propertyKeyStatusSchema,
  requestedObservation: z.string().trim().min(3).max(2000),
});

const reviewPropertyKeyStatusRequestSchema = z.object({
  requestId: z.number().int().positive(),
  decision: z.enum(["approved", "rejected"]),
  reviewNote: z.string().trim().max(2000).optional(),
});

const propertyOwnerDetailsSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  cpf: cpfSchema,
  phone: z.string().trim().min(14).max(20),
  notes: z.string().trim().max(2000).optional(),
});

const taskKindSchema = z.enum(["tarefa", "evento"]);
const taskSectorSchema = z.enum([
  "administrativo",
  "financeiro",
  "atendimento",
  "comercial",
  "juridico",
]);
const taskPersistedStatusSchema = z.enum(["pendente", "em_andamento"]);
const taskEditableStatusSchema = z.enum(["pendente", "em_andamento", "atrasado", "concluida"]);

const taskUpsertBaseSchema = z.object({
  title: z.string().trim().min(2).max(180),
  kind: taskKindSchema,
  sector: taskSectorSchema,
  dueAt: z.string().trim().optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  assigneeIds: z.array(z.number().int().positive()).max(30).default([]),
});

const createTaskItemSchema = taskUpsertBaseSchema.extend({
  status: taskPersistedStatusSchema.default("pendente"),
});

const updateTaskItemSchema = z.object({
  id: z.number().int().positive(),
  status: taskEditableStatusSchema,
  dueAt: z.string().trim().optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  assigneeIds: z.array(z.number().int().positive()).max(30).default([]),
});

const taskNoteSchema = z.object({
  taskId: z.number().int().positive(),
  note: z.string().trim().min(1).max(1200),
});

const createTaskTemplateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  kind: taskKindSchema,
  sector: taskSectorSchema,
  defaultTitle: z.string().trim().min(2).max(180),
  defaultDescription: z.string().trim().max(2000).optional().nullable(),
});

const updateTaskTemplateSchema = createTaskTemplateSchema.extend({
  id: z.number().int().positive(),
});

function setSessionCookie(ctx: { req: any; res: any }, sessionToken: string) {
  const cookieOptions = getSessionCookieOptions(ctx.req);
  ctx.res.cookie(COOKIE_NAME, sessionToken, {
    ...cookieOptions,
    maxAge: ONE_YEAR_MS,
  });
}

function clearSessionCookie(ctx: { req: any; res: any }) {
  const cookieOptions = getSessionCookieOptions(ctx.req);
  ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
}

function normalizeOptionalText(value: unknown) {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeOptionalCpf(value: unknown) {
  const normalized = normalizeOptionalText(value);
  if (!normalized) return undefined;

  if (!isValidCpf(normalized)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "CPF invalido" });
  }

  return normalizeCpf(normalized);
}

function normalizeOptionalBirthDate(value: unknown) {
  if (value === null || value === undefined) return undefined;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }

  const normalized = normalizeOptionalText(String(value));
  if (!normalized) return undefined;

  const isoMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const parsed = new Date(`${year}-${month}-${day}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  const displayMatch = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (displayMatch) {
    const [, day, month, year] = displayMatch;
    const parsed = new Date(`${year}-${month}-${day}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  return undefined;
}

function normalizeOptionalCreci(value: unknown) {
  const normalized = normalizeOptionalText(String(value ?? ""));
  if (!normalized) return undefined;

  const formatted = normalizeCreci(normalized);
  if (!isValidCreci(formatted)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "CRECI invalido" });
  }

  return formatted;
}

function getLeadStatusLabel(status: string | null | undefined) {
  switch (status) {
    case "novo":
      return "Novo";
    case "atendimento":
      return "Em atendimento";
    case "proposta":
      return "Proposta";
    case "negociacao":
      return "Negociação";
    case "fechado":
      return "Fechado";
    case "perdidos":
      return "Perdido";
    default:
      return status || "Não informado";
  }
}

function isRootAdmin(user: {
  role: "cliente" | "corretor" | "administrativo";
  openId?: string | null;
  registrationSource?: string | null;
  email?: string | null;
}) {
  if (user.role !== "administrativo") {
    return false;
  }

  const ownerEmail = ENV.ownerEmail.trim().toLowerCase();
  return (
    (ENV.ownerOpenId.trim().length > 0 && user.openId === ENV.ownerOpenId) ||
    user.registrationSource === "bootstrap" ||
    (ownerEmail.length > 0 && (user.email || "").toLowerCase() === ownerEmail)
  );
}

function assertRootAdminProfileAccessible(user: {
  role: "cliente" | "corretor" | "administrativo";
  openId?: string | null;
  registrationSource?: string | null;
  email?: string | null;
}) {
  if (isRootAdmin(user)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "A ficha do admin principal nao esta disponivel no sistema.",
    });
  }
}

function assertRootAdminMutable(user: {
  role: "cliente" | "corretor" | "administrativo";
  openId?: string | null;
  registrationSource?: string | null;
  email?: string | null;
}) {
  if (isRootAdmin(user)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "O admin principal possui dados fixos e nao pode ser alterado.",
    });
  }
}

type LeadLinkPreview = {
  leadCount: number;
  latestLeadId: number;
  latestInterest: string | null;
  latestOrigin: string | null;
  latestCreatedAt: Date;
};

function buildLeadLinkPreview(
  matchedLeads: Array<{
    id: number;
    interesse: string | null;
    origem: string | null;
    createdAt: Date;
  }>
): LeadLinkPreview | null {
  if (matchedLeads.length === 0) {
    return null;
  }

  const latestLead = matchedLeads[0];
  return {
    leadCount: matchedLeads.length,
    latestLeadId: latestLead.id,
    latestInterest: latestLead.interesse || null,
    latestOrigin: latestLead.origem || null,
    latestCreatedAt: latestLead.createdAt,
  };
}

async function getLeadLinkPreviewByCpf(cpf: string) {
  const { getLeadsByCpf } = await import("./db");
  const matchedLeads = await getLeadsByCpf(cpf);
  return buildLeadLinkPreview(matchedLeads);
}

async function linkUserToExistingLeadsByCpf(userId: number, cpf: string) {
  const { getLeadsByCpf, linkLeadsToUserByCpf } = await import("./db");
  const matchedLeads = await getLeadsByCpf(cpf);

  if (matchedLeads.length === 0) {
    return null;
  }

  await linkLeadsToUserByCpf(cpf, userId);
  return buildLeadLinkPreview(matchedLeads);
}

async function ensurePropertyExists(id: number) {
  const { getPropertyById } = await import("./db");
  const property = await getPropertyById(id);

  if (!property) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Imóvel não encontrado" });
  }

  return property;
}

async function ensurePropertyManagementAccess(
  user: { id: number; role: "cliente" | "corretor" | "administrativo" },
  propertyId: number
) {
  const property = await ensurePropertyExists(propertyId);

  if (user.role === "cliente") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Voce nao tem acesso a este imovel" });
  }

  if (user.role === "corretor" && property.idCorretor !== user.id) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Voce nao tem permissao para gerenciar este imovel" });
  }

  return property;
}

async function ensureLeadAccess(
  user: { id: number; role: "cliente" | "corretor" | "administrativo" },
  leadId: number
) {
  const { getLeadById } = await import("./db");
  const lead = await getLeadById(leadId);

  if (!lead) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Lead não encontrado" });
  }

  if (user.role === "corretor" && lead.idResponsavel !== user.id) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Você não tem acesso a este lead" });
  }

  return lead;
}

function normalizeAssigneeIds(assigneeIds: number[]) {
  return Array.from(new Set(assigneeIds)).sort((a, b) => a - b);
}

function parseOptionalTaskDueAt(value: string | null | undefined) {
  if (!value) return null;

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Data/hora da tarefa invalida",
    });
  }

  return parsedDate;
}

function normalizePropertyDocumentFileName(fileName: string) {
  const sanitized = fileName
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!sanitized) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Informe um nome de arquivo valido.",
    });
  }

  const withExtension = sanitized.toLowerCase().endsWith(".pdf")
    ? sanitized
    : `${sanitized}.pdf`;

  if (withExtension.length > 255) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Nome de arquivo muito longo (maximo de 255 caracteres).",
    });
  }

  return withExtension;
}

function getComputedTaskStatus(task: {
  status: "pendente" | "em_andamento" | "concluida";
  dueAt?: Date | string | null;
}) {
  if (task.status === "concluida") {
    return "concluida" as const;
  }

  const dueAt = task.dueAt ? new Date(task.dueAt) : null;
  if (!dueAt || Number.isNaN(dueAt.getTime())) {
    return task.status;
  }

  if (dueAt.getTime() < Date.now()) {
    return "atrasado" as const;
  }

  return task.status;
}

async function assertValidAssignees(assigneeIds: number[]) {
  if (assigneeIds.length === 0) return;

  const { getUsersByIds } = await import("./db");
  const users = await getUsersByIds(assigneeIds);
  const foundIds = new Set(users.map(user => user.id));
  const missingIds = assigneeIds.filter(id => !foundIds.has(id));

  if (missingIds.length > 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Existem usuarios vinculados invalidos na tarefa.",
    });
  }

  const inactiveIds = users.filter(user => user.isActive !== 1).map(user => user.id);
  if (inactiveIds.length > 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Nao e possivel vincular usuarios inativos em tarefas/eventos.",
    });
  }
}

async function ensureTaskAccess(
  user: { id: number; role: "cliente" | "corretor" | "administrativo" },
  taskId: number
) {
  const { getTaskItemWithRelationsById } = await import("./db");
  const task = await getTaskItemWithRelationsById(taskId);

  if (!task) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Tarefa/Evento nao encontrado" });
  }

  if (user.role === "administrativo") {
    return task;
  }

  const isCreator = task.createdByUserId === user.id;
  const isAssigned = task.assignees.some(assignee => assignee.id === user.id);

  if (!isCreator && !isAssigned) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Voce nao tem acesso a esta tarefa/evento" });
  }

  return task;
}

async function ensureTaskEditAccess(
  user: { id: number; role: "cliente" | "corretor" | "administrativo" },
  taskId: number
) {
  const task = await ensureTaskAccess(user, taskId);

  if (user.role === "administrativo") {
    return task;
  }

  const isCreator = task.createdByUserId === user.id;
  if (!isCreator) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Apenas o criador da tarefa/evento ou um usuario administrativo pode alterar este registro.",
    });
  }

  return task;
}

async function ensureUniqueUserIdentity(
  email: string,
  cpf: string,
  currentUserId?: number
) {
  const { getUserByCpf, getUserByEmail } = await import("./db");

  const userByEmail = await getUserByEmail(email);
  if (userByEmail && userByEmail.id !== currentUserId) {
    throw new TRPCError({ code: "CONFLICT", message: "E-mail já cadastrado" });
  }

  const userByCpf = await getUserByCpf(cpf);
  if (userByCpf && userByCpf.id !== currentUserId) {
    throw new TRPCError({ code: "CONFLICT", message: "CPF já cadastrado" });
  }
}

async function ensureBrokerUser(userId: number) {
  const { getUserById } = await import("./db");
  const broker = await getUserById(userId);

  if (!broker || broker.role !== "corretor") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione um corretor responsavel valido" });
  }

  if (broker.isActive !== 1) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "O corretor responsavel precisa estar ativo" });
  }

  return broker;
}

function normalizeCondominiumText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

async function ensureCondominiumUnique(
  nome: string,
  cidade: string,
  currentCondominiumId?: number
) {
  const { listCondominiums } = await import("./db");
  const allCondominiums = await listCondominiums({ includeInactive: true, limit: 1000 });
  const normalizedNome = normalizeCondominiumText(nome);
  const normalizedCidade = normalizeCondominiumText(cidade);

  const duplicated = allCondominiums.find(item => {
    if (currentCondominiumId && item.id === currentCondominiumId) return false;
    return (
      normalizeCondominiumText(item.nome) === normalizedNome &&
      normalizeCondominiumText(item.cidade) === normalizedCidade
    );
  });

  if (duplicated) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Ja existe um condominio cadastrado com este nome na cidade informada.",
    });
  }
}

async function ensureCondominiumExists(id: number) {
  const { getCondominiumById } = await import("./db");
  const condominium = await getCondominiumById(id);

  if (!condominium) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Condominio nao encontrado." });
  }

  return condominium;
}

function normalizeCondominiumFeatures(rawFeatures?: string[]) {
  if (!rawFeatures || rawFeatures.length === 0) return [] as string[];

  const normalized = rawFeatures
    .map(item => item.trim())
    .filter(Boolean);

  return Array.from(new Set(normalized));
}

async function upsertPropertyOwnerFromInput(
  ownerInput: z.infer<typeof propertyOwnerInputSchema>,
  options?: {
    currentOwnerId?: number;
    confirmedEmailConflict?: boolean;
  }
) {
  const {
    createPropertyOwner,
    getPropertyOwnerByCpf,
    getPropertyOwnersByEmail,
    getUserByCpf,
    updatePropertyOwner,
  } = await import("./db");

  const normalizedOwner = {
    name: ownerInput.name.trim(),
    email: ownerInput.email.trim().toLowerCase(),
    cpf: ownerInput.cpf,
    phone: ownerInput.phone.trim(),
    notes: ownerInput.notes?.trim() || null,
  };

  const ownersWithSameEmail = await getPropertyOwnersByEmail(normalizedOwner.email);
  const emailConflict = ownersWithSameEmail.find(
    owner => owner.cpf !== normalizedOwner.cpf && owner.id !== options?.currentOwnerId
  );

  if (emailConflict && !options?.confirmedEmailConflict) {
    throw new TRPCError({
      code: "CONFLICT",
      message:
        `OWNER_EMAIL_CONFLICT::Ja existe um proprietario com este e-mail vinculado a outro CPF: ` +
        `${emailConflict.name} (${emailConflict.cpf}). Deseja continuar mesmo assim?`,
    });
  }

  const matchedUser = await getUserByCpf(normalizedOwner.cpf);
  const matchedOwner = await getPropertyOwnerByCpf(normalizedOwner.cpf);

  if (matchedOwner) {
    return await updatePropertyOwner(matchedOwner.id, {
      ...normalizedOwner,
      userId: matchedUser?.id ?? matchedOwner.userId ?? null,
    });
  }

  return await createPropertyOwner({
    ...normalizedOwner,
    userId: matchedUser?.id ?? null,
  });
}

async function assertContractProfileIsComplete(userId: number) {
  const { getUserById } = await import("./db");
  const user = await getUserById(userId);

  if (!user) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado" });
  }

  const missingFields = CONTRACT_REQUIRED_USER_FIELDS.filter(field => {
    const value = user[field];
    return value === null || value === undefined || value === "";
  });

  if (missingFields.length > 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "O cliente precisa completar o perfil antes de iniciar um contrato: " +
        missingFields.join(", "),
    });
  }
}

async function getAdminUsersWithFlags(adminUserId: number) {
  const { getAllUsers, getViewedUserIdsByAdmin } = await import("./db");
  const allUsers = await getAllUsers();
  const viewedIds = new Set(await getViewedUserIdsByAdmin(adminUserId));

  return allUsers.map(user => ({
    ...toSafeUser(user),
    isNewForAdmin:
      user.role === "cliente" &&
      user.registrationSource === "public_signup" &&
      !viewedIds.has(user.id),
  }));
}

async function getAdminUserWithFlags(adminUserId: number, userId: number) {
  const { getUserById, getViewedUserIdsByAdmin, markUserAsViewedByAdmin } = await import("./db");
  const user = await getUserById(userId);

  if (!user) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Usuario nao encontrado" });
  }


  const isTrackableNewUser =
    user.role === "cliente" && user.registrationSource === "public_signup";

  if (isTrackableNewUser) {
    await markUserAsViewedByAdmin(adminUserId, user.id);
  }

  const viewedIds = new Set(await getViewedUserIdsByAdmin(adminUserId));

  return {
    ...toSafeUser(user),
    isNewForAdmin: isTrackableNewUser && !viewedIds.has(user.id),
  };
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    register: publicProcedure.input(registerSchema).mutation(async ({ ctx, input }) => {
      const { createUser, linkPropertyOwnersToUserByCpf } = await import("./db");
      await ensureUniqueUserIdentity(input.email, input.cpf);

      const passwordHash = await hashPassword(input.password);
        const createdUser = await createUser({
          openId: `local:${nanoid()}`,
          name: input.name.trim(),
          email: input.email,
          cpf: input.cpf,
          phone: input.phone.trim(),
          birthDate: input.birthDate ? new Date(`${input.birthDate}T00:00:00`) : null,
          loginMethod: "password",
          passwordHash,
          registrationSource: "public_signup",
        role: "cliente",
        isActive: 1,
        lastSignedIn: new Date(),
      });
      const linkedLeadPreview = await linkUserToExistingLeadsByCpf(createdUser.id, input.cpf);
      await linkPropertyOwnersToUserByCpf(createdUser.id, input.cpf);

      const sessionToken = await sdk.createSessionToken(createdUser.openId, {
        name: createdUser.name || createdUser.email || createdUser.openId,
        provider: "local",
        userId: createdUser.id,
      });

      setSessionCookie(ctx, sessionToken);

      void sendWelcomeEmail({
        user: createdUser,
        req: ctx.req,
      }).catch(error => {
        console.error("[Email] Falha ao enviar boas-vindas para novo cliente", error);
      });

      return {
        user: toSafeUser(createdUser),
        linkedLeadPreview,
      };
    }),
    login: publicProcedure.input(loginSchema).mutation(async ({ ctx, input }) => {
      const { getUserByEmail, upsertUser } = await import("./db");
      const user = await getUserByEmail(input.email);

      if (!user || !user.passwordHash) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha inválidos." });

      }
      if (user.isActive !== 1) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Usuário Desativado. Contate o administrador." });
      }

      const isPasswordValid = await verifyPassword(input.password, user.passwordHash);
      if (!isPasswordValid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha inválidos." });
      }

      await upsertUser({
        openId: user.openId,
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name || user.email || user.openId,
        provider: "local",
        userId: user.id,
      });

      setSessionCookie(ctx, sessionToken);

      return toSafeUser(user);
    }),
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  condominios: router({
    list: staffProcedure
      .input(listCondominiumsSchema.optional())
      .query(async ({ ctx, input }) => {
        const { listCondominiums } = await import("./db");
        const includeInactive =
          ctx.user.role === "administrativo" && input?.includeInactive === true;

        return await listCondominiums({
          search: input?.search,
          tipo: input?.tipo,
          includeInactive,
          limit: input?.limit ?? 200,
        });
      }),
    create: staffProcedure.input(createCondominiumSchema).mutation(async ({ ctx, input }) => {
      const { createCondominium } = await import("./db");
      await ensureCondominiumUnique(input.nome, input.cidade);
      const normalizedFeatures = normalizeCondominiumFeatures(input.caracteristicas);

      return await createCondominium({
        nome: input.nome,
        tipo: input.tipo,
        endereco: input.endereco,
        numero: input.numero ?? null,
        complemento: input.complemento ?? null,
        bairro: input.bairro ?? null,
        cidade: input.cidade,
        estado: input.estado.toUpperCase(),
        cep: input.cep ?? null,
        referencia: input.referencia ?? null,
        valorCondominio: input.valorCondominio ?? null,
        valorIptu: input.valorIptu ?? null,
        cnpj: input.cnpj ?? null,
        administradoraNome: input.administradoraNome ?? null,
        administradoraContato: input.administradoraContato ?? null,
        caracteristicas:
          normalizedFeatures.length > 0 ? JSON.stringify(normalizedFeatures) : null,
        observacoes: input.observacoes ?? null,
        isAtivo: 1,
        createdByUserId: ctx.user.id,
      });
    }),
    update: staffProcedure.input(updateCondominiumSchema).mutation(async ({ ctx, input }) => {
      const { updateCondominium } = await import("./db");
      await ensureCondominiumExists(input.id);
      await ensureCondominiumUnique(input.nome, input.cidade, input.id);
      const normalizedFeatures = normalizeCondominiumFeatures(input.caracteristicas);

      const updated = await updateCondominium(input.id, {
        nome: input.nome,
        tipo: input.tipo,
        endereco: input.endereco,
        numero: input.numero ?? null,
        complemento: input.complemento ?? null,
        bairro: input.bairro ?? null,
        cidade: input.cidade,
        estado: input.estado.toUpperCase(),
        cep: input.cep ?? null,
        referencia: input.referencia ?? null,
        valorCondominio: input.valorCondominio ?? null,
        valorIptu: input.valorIptu ?? null,
        cnpj: input.cnpj ?? null,
        administradoraNome: input.administradoraNome ?? null,
        administradoraContato: input.administradoraContato ?? null,
        caracteristicas:
          normalizedFeatures.length > 0 ? JSON.stringify(normalizedFeatures) : null,
        observacoes: input.observacoes ?? null,
      });

      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Condominio nao encontrado." });
      }

      return updated;
    }),
    updateStatus: adminProcedure
      .input(updateCondominiumStatusSchema)
      .mutation(async ({ input }) => {
        const { updateCondominium } = await import("./db");
        await ensureCondominiumExists(input.id);

        const updated = await updateCondominium(input.id, {
          isAtivo: input.isAtivo,
        });

        if (!updated) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Condominio nao encontrado." });
        }

        return updated;
      }),
    delete: adminProcedure
      .input(deleteCondominiumSchema)
      .mutation(async ({ input }) => {
        const { deleteCondominiumAndDetachProperties } = await import("./db");
        await ensureCondominiumExists(input.id);

        const result = await deleteCondominiumAndDetachProperties(input.id);
        if (!result.deletedCondominiumId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Condominio nao encontrado.",
          });
        }

        return result;
      }),
  }),

  properties: router({
    list: publicProcedure.input(propertyListSchema.optional()).query(async ({ ctx, input }) => {
      const { getAllProperties } = await import("./db");
      const isAdmin = ctx.user?.role === "administrativo";
      const showDeletedOnly = isAdmin && input?.showDeletedOnly === true;
      return await getAllProperties({ deletedOnly: showDeletedOnly });
    }),
    getById: publicProcedure.input(idSchema).query(async ({ ctx, input }) => {
      const { getPropertyById, getPropertyByIdWithRelations } = await import("./db");
      if (!ctx.user || ctx.user.role === "cliente") {
        return await getPropertyById(input.id);
      }

      const propertyWithRelations = await getPropertyByIdWithRelations(input.id);
      if (!propertyWithRelations) {
        return propertyWithRelations;
      }

      if (ctx.user.role === "administrativo") {
        return propertyWithRelations;
      }

      return {
        ...propertyWithRelations,
        proprietario: propertyWithRelations.proprietario ?? null,
        cadastradoPor: null,
      };
    }),
    getByIdAdmin: adminProcedure.input(idSchema).query(async ({ input }) => {
      const { getPropertyByIdWithRelations } = await import("./db");
      const propertyWithRelations = await getPropertyByIdWithRelations(input.id, { includeDeleted: true });

      if (!propertyWithRelations) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Imovel nao encontrado" });
      }

      return propertyWithRelations;
    }),
    getDestacados: publicProcedure.query(async () => {
      const { getDestacados } = await import("./db");
      return await getDestacados();
    }),
    myProperties: staffProcedure.query(async ({ ctx }) => {
      const { getAllPropertiesWithRelations, getPropertiesByCorretor } = await import("./db");
      if (ctx.user.role === "administrativo") {
        return await getAllPropertiesWithRelations();
      }
      return await getPropertiesByCorretor(ctx.user.id);
    }),
    create: staffProcedure.input(createPropertySchema).mutation(async ({ ctx, input }) => {
      const { createProperty } = await import("./db");

      const idCorretor =
        ctx.user.role === "administrativo"
          ? input.idCorretor
          : ctx.user.id;

      if (!idCorretor) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Selecione o corretor responsavel antes de cadastrar o imovel.",
        });
      }

      await ensureBrokerUser(idCorretor);
      const owner = await upsertPropertyOwnerFromInput(input.owner, {
        confirmedEmailConflict: input.confirmedOwnerEmailConflict,
      });
      const emCondominio = input.emCondominio === true;
      let idCondominio: number | null = emCondominio ? input.idCondominio ?? null : null;
      let tipoCondominio: z.infer<typeof condominiumTypeSchema> | null = emCondominio
        ? input.tipoCondominio ?? null
        : null;

      if (emCondominio) {
        if (!idCondominio) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Selecione o condominio vinculado ao imovel.",
          });
        }

        if (!tipoCondominio) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Selecione o tipo do condominio (casa ou apartamento).",
          });
        }

        const condominium = await ensureCondominiumExists(idCondominio);
        if (ctx.user.role !== "administrativo" && condominium.isAtivo !== 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "O condominio selecionado esta inativo.",
          });
        }

        if (condominium.tipo !== tipoCondominio) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "O tipo selecionado nao corresponde ao tipo cadastrado no condominio.",
          });
        }
      } else {
        idCondominio = null;
        tipoCondominio = null;
      }

      return await createProperty({
        titulo: input.titulo,
        descricao: input.descricao ?? null,
        tipo: input.tipo,
        finalidade: input.finalidade,
        valor: input.valor,
        valorLocacao: input.valorLocacao ?? null,
        area: input.area ?? null,
        quartos: input.quartos ?? null,
        banheiros: input.banheiros ?? null,
        vagas: input.vagas ?? null,
        endereco: input.endereco,
        numero: input.numero ?? null,
        bairro: input.bairro ?? null,
        cidade: input.cidade,
        estado: input.estado,
        cep: input.cep ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        fotos: input.fotos ?? null,
        destaque: input.destaque ?? 0,
        status: input.status ?? "ativo",
        emCondominio: emCondominio ? 1 : 0,
        tipoCondominio,
        idCondominio,
        idCorretor,
        idProprietario: owner.id,
        createdByUserId: ctx.user.id,
      });
    }),
    uploadPhoto: staffProcedure
      .input(propertyPhotoUploadSchema)
      .mutation(async ({ input }) => {
        const { optimizeAndStorePropertyImage } = await import("./_core/property-images");

        try {
          return await optimizeAndStorePropertyImage({
            fileName: input.fileName,
            dataUrl: input.dataUrl,
          });
        } catch (error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              error instanceof Error
                ? error.message
                : "Nao foi possivel processar a imagem enviada.",
          });
        }
      }),
    deleteUploadedPhoto: staffProcedure
      .input(propertyUploadedPhotoDeleteSchema)
      .mutation(async ({ input }) => {
        const { removeStoredPropertyImageByUrl } = await import("./_core/property-images");
        await removeStoredPropertyImageByUrl(input.url);
        return { success: true } as const;
      }),
    update: staffProcedure.input(updatePropertySchema).mutation(async ({ ctx, input }) => {
      const { updateProperty } = await import("./db");
      const { id, owner: ownerInput, confirmedOwnerEmailConflict, ...data } = input;
      const property = await ensurePropertyExists(id);

      if (ctx.user.role === "corretor" && property.idCorretor !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Você não tem permissão para editar este imóvel" });
      }

      const idCorretor =
        ctx.user.role === "corretor"
          ? ctx.user.id
          : data.idCorretor;

      if (!idCorretor) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Selecione o corretor responsavel antes de salvar o imóvel.",
        });
      }

      await ensureBrokerUser(idCorretor);
      const owner = await upsertPropertyOwnerFromInput(ownerInput, {
        currentOwnerId: property.idProprietario ?? undefined,
        confirmedEmailConflict: confirmedOwnerEmailConflict,
      });
      const emCondominio =
        data.emCondominio !== undefined
          ? data.emCondominio
          : property.emCondominio === 1;
      let idCondominio: number | null = emCondominio
        ? (data.idCondominio !== undefined ? data.idCondominio : property.idCondominio ?? null)
        : null;
      let tipoCondominio: z.infer<typeof condominiumTypeSchema> | null = emCondominio
        ? (data.tipoCondominio !== undefined
          ? data.tipoCondominio
          : property.tipoCondominio ?? null)
        : null;

      if (emCondominio) {
        if (!idCondominio) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Selecione o condominio vinculado ao imovel.",
          });
        }

        const condominium = await ensureCondominiumExists(idCondominio);
        if (
          ctx.user.role !== "administrativo" &&
          condominium.isAtivo !== 1 &&
          condominium.id !== property.idCondominio
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "O condominio selecionado esta inativo.",
          });
        }

        if (!tipoCondominio) {
          tipoCondominio = condominium.tipo;
        }

        if (condominium.tipo !== tipoCondominio) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "O tipo selecionado nao corresponde ao tipo cadastrado no condominio.",
          });
        }
      } else {
        idCondominio = null;
        tipoCondominio = null;
      }

      return await updateProperty(id, {
        titulo: data.titulo,
        descricao: data.descricao ?? null,
        tipo: data.tipo,
        finalidade: data.finalidade,
        valor: data.valor,
        valorLocacao: data.valorLocacao ?? null,
        area: data.area ?? null,
        quartos: data.quartos ?? null,
        banheiros: data.banheiros ?? null,
        vagas: data.vagas ?? null,
        endereco: data.endereco,
        numero: data.numero ?? null,
        bairro: data.bairro ?? null,
        cidade: data.cidade,
        estado: data.estado,
        cep: data.cep ?? null,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        fotos: data.fotos ?? null,
        destaque: data.destaque ?? 0,
        status: data.status ?? property.status,
        emCondominio: emCondominio ? 1 : 0,
        tipoCondominio,
        idCondominio,
        idCorretor,
        idProprietario: owner.id,
      });
    }),
    delete: adminProcedure.input(deletePropertySchema).mutation(async ({ ctx, input }) => {
      const { softDeleteProperty } = await import("./db");
      const property = await ensurePropertyExists(input.id);

      if (input.confirmationText !== "EXCLUIR IMOVEL") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Confirme a exclusao digitando EXCLUIR IMOVEL.",
        });
      }

      if (property.lixeira === 1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Este imovel ja esta na lixeira.",
        });
      }

      return await softDeleteProperty(input.id, {
        motivoExclusao: input.motivoExclusao.trim(),
        excluidoPorUserId: ctx.user.id,
      });
    }),
    updateLegalDetails: adminProcedure
      .input(updatePropertyLegalDetailsSchema)
      .mutation(async ({ input }) => {
        const { getPropertyById, updatePropertyLegalDetails } = await import("./db");
        const property = await getPropertyById(input.id, { includeDeleted: true });
        if (!property) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Imovel nao encontrado" });
        }

        return await updatePropertyLegalDetails(input.id, {
          inscricaoImobiliaria: normalizeOptionalText(input.inscricaoImobiliaria) ?? null,
          matriculaRegistro: normalizeOptionalText(input.matriculaRegistro) ?? null,
          cartorioRegistro: normalizeOptionalText(input.cartorioRegistro) ?? null,
          registroMunicipal: normalizeOptionalText(input.registroMunicipal) ?? null,
          informacoesLegais: normalizeOptionalText(input.informacoesLegais) ?? null,
          observacoesJuridicas: normalizeOptionalText(input.observacoesJuridicas) ?? null,
        });
      }),
    documents: staffProcedure
      .input(propertyDocumentsSchema)
      .query(async ({ ctx, input }) => {
        const { getPropertyDocuments } = await import("./db");
        await ensurePropertyManagementAccess(ctx.user, input.idImovel);
        return await getPropertyDocuments(input.idImovel);
      }),
    addDocument: staffProcedure
      .input(createPropertyDocumentSchema)
      .mutation(async ({ ctx, input }) => {
        const { createPropertyDocument } = await import("./db");
        await ensurePropertyManagementAccess(ctx.user, input.idImovel);

        const normalizedMimeType = input.tipoArquivo.trim().toLowerCase();
        if (normalizedMimeType !== "application/pdf") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Apenas documentos PDF sao permitidos" });
        }

        if (!input.urlArquivo.startsWith("data:application/pdf")) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Arquivo PDF invalido" });
        }

        return await createPropertyDocument({
          idImovel: input.idImovel,
          idUsuario: ctx.user.id,
          nomeArquivo: input.nomeArquivo.trim(),
          urlArquivo: input.urlArquivo.trim(),
          tipoArquivo: normalizedMimeType,
        });
      }),
    deleteDocument: staffProcedure
      .input(deletePropertyDocumentSchema)
      .mutation(async ({ ctx, input }) => {
        const { deletePropertyDocument, getPropertyDocumentById } = await import("./db");
        const document = await getPropertyDocumentById(input.id);

        if (!document) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Documento nao encontrado" });
        }

        await ensurePropertyManagementAccess(ctx.user, document.idImovel);
        await deletePropertyDocument(input.id);

        return { success: true } as const;
      }),
    renameDocument: staffProcedure
      .input(renamePropertyDocumentSchema)
      .mutation(async ({ ctx, input }) => {
        const { getPropertyDocumentById, updatePropertyDocumentName } = await import("./db");
        const document = await getPropertyDocumentById(input.id);

        if (!document) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Documento nao encontrado" });
        }

        await ensurePropertyManagementAccess(ctx.user, document.idImovel);

        const normalizedFileName = normalizePropertyDocumentFileName(input.nomeArquivo);
        return await updatePropertyDocumentName(input.id, normalizedFileName);
      }),
    keyStatusRequests: staffProcedure
      .input(propertyKeyStatusRequestsListSchema)
      .query(async ({ ctx, input }) => {
        const { getPropertyKeyStatusRequestsByPropertyId } = await import("./db");
        await ensurePropertyManagementAccess(ctx.user, input.idImovel);
        return await getPropertyKeyStatusRequestsByPropertyId(input.idImovel);
      }),
    requestKeyStatusChange: staffProcedure
      .input(requestPropertyKeyStatusChangeSchema)
      .mutation(async ({ ctx, input }) => {
        const { createPropertyKeyStatusRequest, updatePropertyKeyStatus } = await import("./db");
        await ensurePropertyManagementAccess(ctx.user, input.idImovel);

        const requestedObservation = input.requestedObservation.trim();

        if (ctx.user.role === "administrativo") {
          const approvedRequest = await createPropertyKeyStatusRequest({
            idImovel: input.idImovel,
            requestedByUserId: ctx.user.id,
            requestedStatus: input.requestedStatus,
            requestedObservation,
            status: "approved",
            reviewedByUserId: ctx.user.id,
            reviewNote: "Aprovacao automatica de administrador.",
            reviewedAt: new Date(),
          });

          const updatedProperty = await updatePropertyKeyStatus(input.idImovel, {
            keyStatus: input.requestedStatus,
            keyStatusObservation: requestedObservation,
            keyStatusUpdatedByUserId: ctx.user.id,
            keyStatusUpdatedAt: new Date(),
          });

          return {
            mode: "applied" as const,
            request: approvedRequest,
            property: updatedProperty,
          };
        }

        const pendingRequest = await createPropertyKeyStatusRequest({
          idImovel: input.idImovel,
          requestedByUserId: ctx.user.id,
          requestedStatus: input.requestedStatus,
          requestedObservation,
          status: "pending",
        });

        return {
          mode: "requested" as const,
          request: pendingRequest,
          property: null,
        };
      }),
    reviewKeyStatusRequest: adminProcedure
      .input(reviewPropertyKeyStatusRequestSchema)
      .mutation(async ({ ctx, input }) => {
        const { getPropertyKeyStatusRequestById, updatePropertyKeyStatus, updatePropertyKeyStatusRequest } =
          await import("./db");

        const request = await getPropertyKeyStatusRequestById(input.requestId);
        if (!request) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Solicitacao de chave nao encontrada" });
        }

        if (request.status !== "pending") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Essa solicitacao ja foi analisada anteriormente",
          });
        }

        const reviewNote = normalizeOptionalText(input.reviewNote) ?? null;
        const nextStatus = input.decision === "approved" ? "approved" : "rejected";

        const reviewedRequest = await updatePropertyKeyStatusRequest(request.id, {
          status: nextStatus,
          reviewedByUserId: ctx.user.id,
          reviewedAt: new Date(),
          reviewNote,
        });

        if (nextStatus === "rejected") {
          return {
            request: reviewedRequest,
            property: null,
          };
        }

        await ensurePropertyExists(request.idImovel);
        const updatedProperty = await updatePropertyKeyStatus(request.idImovel, {
          keyStatus: request.requestedStatus,
          keyStatusObservation: request.requestedObservation,
          keyStatusUpdatedByUserId: ctx.user.id,
          keyStatusUpdatedAt: new Date(),
        });

        return {
          request: reviewedRequest,
          property: updatedProperty,
        };
      }),
  }),

  leads: router({
    list: staffProcedure.query(async ({ ctx }) => {
      const { processLeadSlaTick } = await import("./_core/leadSla");
      const { getAllLeads, getLeadsByResponsavel } = await import("./db");
      await processLeadSlaTick();
      if (ctx.user.role === "administrativo") {
        return await getAllLeads();
      }
      return await getLeadsByResponsavel(ctx.user.id);
    }),
    getById: staffProcedure.input(idSchema).query(async ({ ctx, input }) => {
      const { processLeadSlaTick } = await import("./_core/leadSla");
      await processLeadSlaTick();
      return await ensureLeadAccess(ctx.user, input.id);
    }),
    create: publicProcedure.input(z.any()).mutation(async ({ ctx, input }) => {
      const { createLead, createLeadInteraction, getUserByCpf, getUserById, updateUser } = await import("./db");
      const payload = { ...(input as any) };
      const normalizedCpf = normalizeOptionalCpf(payload.cpf);
      const normalizedBirthDate = normalizeOptionalBirthDate(payload.birthDate);

      payload.nome = normalizeOptionalText(payload.nome);
      payload.email = normalizeOptionalText(payload.email) || null;
      payload.telefone = normalizeOptionalText(payload.telefone) || null;
      payload.origem = normalizeOptionalText(payload.origem) || null;
      payload.interesse = normalizeOptionalText(payload.interesse) || null;
      payload.observacao = normalizeOptionalText(payload.observacao) || null;
      payload.status = normalizeOptionalText(payload.status) || "novo";
      payload.cpf = normalizedCpf || null;
      payload.birthDate = normalizedBirthDate || null;
      payload.assignmentCycleStartedAt = new Date();
      payload.assignmentSlaNotifiedAt = null;

      if (ctx.user && (ctx.user.role === "corretor" || ctx.user.role === "administrativo")) {
        payload.idResponsavel = ctx.user.id;
        payload.assignedAt = new Date();
      } else {
        delete payload.idResponsavel;
      }

      if (payload.status !== "novo" && !payload.idResponsavel) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Lead precisa de responsável antes de sair de Novo.",
        });
      }

      if (payload.status === "atendimento" && payload.idResponsavel) {
        payload.attendedAt = new Date();
      }

      if (ctx.user?.id) {
        const currentUser = await getUserById(ctx.user.id);
        if (currentUser?.cpf) {
          payload.userId = currentUser.id;
          payload.cpf = currentUser.cpf;
          payload.birthDate = payload.birthDate || currentUser.birthDate || null;
          payload.nome = payload.nome || currentUser.name || currentUser.email || "Cliente";
          payload.email = payload.email || currentUser.email || null;
          payload.telefone = payload.telefone || currentUser.phone || null;
        }
      } else if (normalizedCpf) {
        const matchedUser = await getUserByCpf(normalizedCpf);
        if (matchedUser) {
          payload.userId = matchedUser.id;
          payload.birthDate = payload.birthDate || matchedUser.birthDate || null;

          if (payload.birthDate && !matchedUser.birthDate) {
            await updateUser(matchedUser.id, { birthDate: payload.birthDate });
          }
        }
      }

      if (!payload.nome) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Nome do lead e obrigatorio" });
      }

      const [createdLead] = await createLead(payload);
      const createdLeadId = createdLead?.id;

      if (createdLeadId) {
        await createLeadInteraction({
          idLead: createdLeadId,
          idUsuario: ctx.user?.id ?? null,
          eventType: "lead_created",
          message: "Lead criado no sistema.",
        });

        if (payload.idResponsavel) {
          await createLeadInteraction({
            idLead: createdLeadId,
            idUsuario: ctx.user?.id ?? null,
            eventType: "lead_assigned",
            message: `Lead direcionado ao responsável ID ${payload.idResponsavel}.`,
          });
        }
      }

      return createdLead;
    }),
    update: staffProcedure.input(z.any()).mutation(async ({ ctx, input }) => {
      const { createLeadInteraction, getUserByCpf, updateLead } = await import("./db");
      const { id, ...data } = input as any;
      const currentLead = await ensureLeadAccess(ctx.user, id);

      if (ctx.user.role !== "administrativo") {
        delete data.idResponsavel;
      }

      if ("cpf" in data) {
        const normalizedCpf = normalizeOptionalCpf(data.cpf);
        data.cpf = normalizedCpf || null;
        data.userId = null;

        if (normalizedCpf) {
          const matchedUser = await getUserByCpf(normalizedCpf);
          if (matchedUser) {
            data.userId = matchedUser.id;
          }
        }
      }

      if ("birthDate" in data) {
        const normalizedBirthDate = normalizeOptionalBirthDate(data.birthDate);
        data.birthDate = normalizedBirthDate || null;
      }

      const nextStatusRaw = "status" in data ? normalizeOptionalText(data.status) : currentLead.status;
      const nextStatus = nextStatusRaw || currentLead.status;
      const nextResponsibleId =
        "idResponsavel" in data
          ? (data.idResponsavel === null ? null : Number(data.idResponsavel))
          : currentLead.idResponsavel;

      if (nextStatus !== "novo" && !nextResponsibleId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Lead precisa de responsável antes de sair de Novo.",
        });
      }

      if (nextStatus !== currentLead.status) {
        data.status = nextStatus;
      }

      if (
        nextStatus === "atendimento" &&
        currentLead.status !== "atendimento" &&
        !currentLead.attendedAt
      ) {
        data.attendedAt = new Date();
      }

      await updateLead(id, data);

      if (nextStatus !== currentLead.status) {
        await createLeadInteraction({
          idLead: id,
          idUsuario: ctx.user.id,
          eventType: "lead_status_changed",
          message: `Status alterado de ${getLeadStatusLabel(currentLead.status)} para ${getLeadStatusLabel(nextStatus)}.`,
        });
      }

      return await ensureLeadAccess(ctx.user, id);
    }),
    assign: adminProcedure.input(assignLeadSchema).mutation(async ({ ctx, input }) => {
      const { createLeadInteraction, getUserById, updateLead } = await import("./db");
      const lead = await ensureLeadAccess({ id: 0, role: "administrativo" }, input.leadId);

      if (input.userId !== null) {
        const assignedUser = await getUserById(input.userId);
        if (!assignedUser || assignedUser.role !== "corretor" || assignedUser.isActive !== 1) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione um corretor ativo" });
        }
      }

      if (input.userId === null) {
        await updateLead(input.leadId, {
          idResponsavel: null,
          status: "novo",
          assignedAt: null,
          attendedAt: null,
          assignmentCycleStartedAt: new Date(),
          assignmentSlaNotifiedAt: null,
        });

        await createLeadInteraction({
          idLead: input.leadId,
          idUsuario: ctx.user.id,
          eventType: "lead_unassigned",
          message: "Lead desvinculado do responsável e aguardando novo direcionamento.",
        });

        return await ensureLeadAccess({ id: 0, role: "administrativo" }, input.leadId);
      }

      await updateLead(input.leadId, {
        idResponsavel: input.userId,
        assignedAt: new Date(),
        assignmentSlaNotifiedAt: null,
      });

      await createLeadInteraction({
        idLead: input.leadId,
        idUsuario: ctx.user.id,
        eventType: "lead_assigned",
        message: `Lead direcionado ao responsável ID ${input.userId}.`,
      });

      if (lead.status === "atendimento") {
        await createLeadInteraction({
          idLead: input.leadId,
          idUsuario: ctx.user.id,
          eventType: "lead_attention_required",
          message: "Lead estava em atendimento e teve responsável alterado.",
        });
      }

      return await ensureLeadAccess({ id: 0, role: "administrativo" }, input.leadId);
    }),
    delete: adminProcedure.input(idSchema).mutation(async ({ input }) => {
      const { deleteLead } = await import("./db");
      await ensureLeadAccess({ id: 0, role: "administrativo" }, input.id);
      return await deleteLead(input.id);
    }),
    getInteractions: staffProcedure
      .input(z.object({ idLead: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const { getLeadInteractions } = await import("./db");
        await ensureLeadAccess(ctx.user, input.idLead);
        return await getLeadInteractions(input.idLead);
      }),
    getNotes: staffProcedure
      .input(z.object({ idLead: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const { getLeadNotes } = await import("./db");
        await ensureLeadAccess(ctx.user, input.idLead);
        return await getLeadNotes(input.idLead);
      }),
    addNote: staffProcedure.input(z.any()).mutation(async ({ ctx, input }) => {
      const { createLeadInteraction, createLeadNote } = await import("./db");
      await ensureLeadAccess(ctx.user, (input as any).idLead);
      const createdNote = await createLeadNote({ ...(input as any), idUsuario: ctx.user.id });
      await createLeadInteraction({
        idLead: (input as any).idLead,
        idUsuario: ctx.user.id,
        eventType: "lead_note_added",
        message: "Nova anotação registrada no lead.",
      });
      return createdNote;
    }),
    getFiles: staffProcedure
      .input(z.object({ idLead: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const { getLeadFiles } = await import("./db");
        await ensureLeadAccess(ctx.user, input.idLead);
        return await getLeadFiles(input.idLead);
      }),
    addFile: staffProcedure.input(z.any()).mutation(async ({ ctx, input }) => {
      const { createLeadFile, createLeadInteraction } = await import("./db");
      await ensureLeadAccess(ctx.user, (input as any).idLead);
      const createdFile = await createLeadFile({ ...(input as any), idUsuario: ctx.user.id });
      await createLeadInteraction({
        idLead: (input as any).idLead,
        idUsuario: ctx.user.id,
        eventType: "lead_file_added",
        message: "Arquivo anexado ao lead.",
      });
      return createdFile;
    }),
  }),

  tasks: router({
    list: staffProcedure.query(async ({ ctx }) => {
      const {
        getAllTaskItemsWithRelations,
        getTaskItemsForUserWithRelations,
        purgeCompletedTaskItemsOlderThan,
      } = await import("./db");
      await purgeCompletedTaskItemsOlderThan(30);
      const taskItems =
        ctx.user.role === "administrativo"
          ? await getAllTaskItemsWithRelations()
          : await getTaskItemsForUserWithRelations(ctx.user.id);

      return taskItems.map(taskItem => ({
        ...taskItem,
        computedStatus: getComputedTaskStatus(taskItem),
        isAssignedToCurrentUser: taskItem.assignees.some(assignee => assignee.id === ctx.user.id),
      }));
    }),
    templates: staffProcedure.query(async () => {
      const { getAllTaskItemTemplatesWithCreator } = await import("./db");
      return await getAllTaskItemTemplatesWithCreator();
    }),
    users: staffProcedure.query(async () => {
      const { getAllUsers } = await import("./db");
      const users = await getAllUsers();

      return users
        .filter(user => user.isActive === 1)
        .map(user => ({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        }));
    }),
    createTemplate: adminProcedure
      .input(createTaskTemplateSchema)
      .mutation(async ({ ctx, input }) => {
        const { createTaskItemTemplate } = await import("./db");
        return await createTaskItemTemplate({
          name: input.name.trim(),
          kind: input.kind,
          sector: input.sector,
          defaultTitle: input.defaultTitle.trim(),
          defaultDescription: input.defaultDescription?.trim() || null,
          createdByUserId: ctx.user.id,
        });
      }),
    updateTemplate: adminProcedure
      .input(updateTaskTemplateSchema)
      .mutation(async ({ input }) => {
        const { getTaskItemTemplateById, updateTaskItemTemplate } = await import("./db");
        const template = await getTaskItemTemplateById(input.id);
        if (!template) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Modelo personalizado nao encontrado.",
          });
        }

        return await updateTaskItemTemplate(input.id, {
          name: input.name.trim(),
          kind: input.kind,
          sector: input.sector,
          defaultTitle: input.defaultTitle.trim(),
          defaultDescription: input.defaultDescription?.trim() || null,
        });
      }),
    deleteTemplate: adminProcedure.input(idSchema).mutation(async ({ input }) => {
      const { deleteTaskItemTemplate, getTaskItemTemplateById } = await import("./db");
      const template = await getTaskItemTemplateById(input.id);
      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Modelo personalizado nao encontrado.",
        });
      }

      await deleteTaskItemTemplate(input.id);
      return { success: true } as const;
    }),
    summary: staffProcedure.query(async ({ ctx }) => {
      const {
        getAllTaskItemsWithRelations,
        getTaskItemsForUserWithRelations,
        purgeCompletedTaskItemsOlderThan,
      } = await import("./db");
      await purgeCompletedTaskItemsOlderThan(30);
      const taskItems =
        ctx.user.role === "administrativo"
          ? await getAllTaskItemsWithRelations()
          : await getTaskItemsForUserWithRelations(ctx.user.id);

      const assignedItems = taskItems.filter(taskItem =>
        taskItem.assignees.some(assignee => assignee.id === ctx.user.id)
      );
      const assignedOpenItems = assignedItems.filter(
        taskItem => getComputedTaskStatus(taskItem) !== "concluida"
      );
      const assignedOverdueCount = assignedOpenItems.filter(
        taskItem => getComputedTaskStatus(taskItem) === "atrasado"
      ).length;

      return {
        assignedOpenCount: assignedOpenItems.length,
        assignedOverdueCount,
        totalVisibleCount: taskItems.length,
      };
    }),
    create: staffProcedure.input(createTaskItemSchema).mutation(async ({ ctx, input }) => {
      const { createTaskItem, getTaskItemWithRelationsById, replaceTaskItemAssignees } = await import("./db");
      const normalizedAssigneeIds = normalizeAssigneeIds(input.assigneeIds);
      await assertValidAssignees(normalizedAssigneeIds);

      const dueAt = parseOptionalTaskDueAt(input.dueAt);
      if (input.kind === "evento" && !dueAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Eventos precisam ter data e horario definidos.",
        });
      }

      const created = await createTaskItem({
        title: input.title.trim(),
        kind: input.kind,
        sector: input.sector,
        status: input.status,
        dueAt,
        description: input.description?.trim() || null,
        createdByUserId: ctx.user.id,
      });

      await replaceTaskItemAssignees(created.id, normalizedAssigneeIds);
      const fullTaskItem = await getTaskItemWithRelationsById(created.id);

      if (!fullTaskItem) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Nao foi possivel carregar a tarefa criada.",
        });
      }

      return {
        ...fullTaskItem,
        computedStatus: getComputedTaskStatus(fullTaskItem),
        isAssignedToCurrentUser: fullTaskItem.assignees.some(assignee => assignee.id === ctx.user.id),
      };
    }),
    update: staffProcedure.input(updateTaskItemSchema).mutation(async ({ ctx, input }) => {
      const { getTaskItemWithRelationsById, replaceTaskItemAssignees, updateTaskItem } = await import("./db");
      const currentTask = await ensureTaskEditAccess(ctx.user, input.id);

      const normalizedAssigneeIds = normalizeAssigneeIds(input.assigneeIds);
      await assertValidAssignees(normalizedAssigneeIds);

      const dueAt = parseOptionalTaskDueAt(input.dueAt);
      if (currentTask.kind === "evento" && !dueAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Eventos precisam ter data e horario definidos.",
        });
      }

      await updateTaskItem(input.id, {
        dueAt,
        description: input.description?.trim() || null,
        status: input.status === "atrasado" ? "pendente" : input.status,
      });
      await replaceTaskItemAssignees(input.id, normalizedAssigneeIds);

      const updatedTaskItem = await getTaskItemWithRelationsById(input.id);
      if (!updatedTaskItem) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Nao foi possivel carregar a tarefa atualizada.",
        });
      }

      return {
        action: "updated" as const,
        task: {
          ...updatedTaskItem,
          computedStatus: getComputedTaskStatus(updatedTaskItem),
          isAssignedToCurrentUser: updatedTaskItem.assignees.some(
            assignee => assignee.id === ctx.user.id
          ),
        },
      };
    }),
    delete: staffProcedure.input(idSchema).mutation(async ({ ctx, input }) => {
      const { deleteTaskItem } = await import("./db");
      await ensureTaskEditAccess(ctx.user, input.id);
      await deleteTaskItem(input.id);
      return { success: true } as const;
    }),
    notes: staffProcedure
      .input(z.object({ taskId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const { getTaskItemNotes } = await import("./db");
        await ensureTaskAccess(ctx.user, input.taskId);
        return await getTaskItemNotes(input.taskId);
      }),
    addNote: staffProcedure.input(taskNoteSchema).mutation(async ({ ctx, input }) => {
      const { createTaskItemNote, updateTaskItem } = await import("./db");
      const task = await ensureTaskEditAccess(ctx.user, input.taskId);

      const createdNote = await createTaskItemNote({
        taskId: input.taskId,
        userId: ctx.user.id,
        note: input.note.trim(),
      });

      if (task.status !== "concluida") {
        await updateTaskItem(input.taskId, {});
      }

      return createdNote;
    }),
  }),

  contracts: router({
    myContracts: clientProcedure.query(async ({ ctx }) => {
      const { getContractsByCliente } = await import("./db");
      return await getContractsByCliente(ctx.user.id);
    }),
    list: adminProcedure.query(async () => {
      const { getAllContracts } = await import("./db");
      return await getAllContracts();
    }),
    create: adminProcedure.input(z.any()).mutation(async ({ input }) => {
      await assertContractProfileIsComplete((input as any).idCliente);
      const { createContract } = await import("./db");
      return await createContract(input as any);
    }),
  }),

  documents: router({
    myDocuments: clientProcedure.query(async ({ ctx }) => {
      const { getDocumentsByUsuario } = await import("./db");
      return await getDocumentsByUsuario(ctx.user.id);
    }),
    create: clientProcedure.input(z.any()).mutation(async ({ ctx, input }) => {
      const { createDocument } = await import("./db");
      return await createDocument({ ...(input as any), idUsuario: ctx.user.id });
    }),
    updateStatus: adminProcedure.input(z.any()).mutation(async ({ input }) => {
      const { id, status } = input as any;
      const { updateDocument } = await import("./db");
      return await updateDocument(id, { status });
    }),
  }),

  profile: router({
    update: protectedProcedure.input(profileDetailsSchema).mutation(async ({ ctx, input }) => {
      const { getUserById, linkPropertyOwnersToUserByCpf, updateUser } = await import("./db");
      const user = await getUserById(ctx.user.id);
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Usuario nao encontrado" });
      }
      assertRootAdminMutable(user);
      /*

        throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado" });
      }

      */
      await ensureUniqueUserIdentity(input.email, input.cpf, ctx.user.id);
      const normalizedCreci = user.role === "corretor" ? normalizeOptionalCreci(input.creci) : undefined;

      await updateUser(ctx.user.id, {
        name: input.name.trim(),
        email: input.email,
        cpf: input.cpf,
        phone: input.phone?.trim() || null,
        creci: user.role === "corretor" ? normalizedCreci || null : null,
        creciStatus: user.role === "corretor" && normalizedCreci ? "pending" : null,
        creciVerifiedAt: null,
        creciVerifiedByUserId: null,
        birthDate: input.birthDate ? new Date(`${input.birthDate}T00:00:00`) : null,
        profession: input.profession?.trim() || null,
        grossMonthlyIncome: input.grossMonthlyIncome ?? null,
        maritalStatus: input.maritalStatus ?? null,
        householdIncome: input.householdIncome ?? null,
        rg: input.rg?.trim() || null,
        nationality: input.nationality?.trim() || null,
        address: input.address?.trim() || null,
        neighborhood: input.neighborhood?.trim() || null,
        addressNumber: input.addressNumber?.trim() || null,
        city: input.city?.trim() || null,
        state: input.state?.trim() || null,
        zipCode: input.zipCode?.trim() || null,
        notes: input.notes?.trim() || null,
      });
      await linkUserToExistingLeadsByCpf(ctx.user.id, input.cpf);
      await linkPropertyOwnersToUserByCpf(ctx.user.id, input.cpf);

      const updatedUser = await getUserById(ctx.user.id);
      if (!updatedUser) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado" });
      }

      return toSafeUser(updatedUser);
    }),
  }),

  admin: router({
    users: adminProcedure.query(async ({ ctx }) => {
      return await getAdminUsersWithFlags(ctx.user.id);
    }),
    leadLinkPreviewByCpf: adminProcedure
      .input(adminLeadLinkPreviewSchema)
      .query(async ({ input }) => {
        return await getLeadLinkPreviewByCpf(input.cpf);
      }),
    hasNewUsers: adminProcedure.query(async ({ ctx }) => {
      const { hasNewPublicUsersForAdmin } = await import("./db");
      return await hasNewPublicUsersForAdmin(ctx.user.id);
    }),
    userById: adminProcedure.input(idSchema).query(async ({ ctx, input }) => {
      const user = await getAdminUserWithFlags(ctx.user.id, input.id);
      assertRootAdminProfileAccessible(user);
      return user;
    }),
    propertyOwnerById: adminProcedure.input(idSchema).query(async ({ input }) => {
      const { getPropertyOwnerById, getUserById } = await import("./db");
      const owner = await getPropertyOwnerById(input.id);

      if (!owner) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Proprietario nao encontrado" });
      }

      const linkedUser = owner.userId ? await getUserById(owner.userId) : null;

      return {
        ...owner,
        linkedUser: linkedUser ? toSafeUser(linkedUser) : null,
      };
    }),
    markAllNewUsersAsViewed: adminProcedure.mutation(async ({ ctx }) => {
      const { getAllUsers, getViewedUserIdsByAdmin, markUsersAsViewedByAdmin } = await import("./db");
      const users = await getAllUsers();
      const viewedIds = new Set(await getViewedUserIdsByAdmin(ctx.user.id));
      const newUserIds = users
        .filter(
          user =>
            user.role === "cliente" &&
            user.registrationSource === "public_signup" &&
            !viewedIds.has(user.id)
        )
        .map(user => user.id);

      await markUsersAsViewedByAdmin(ctx.user.id, newUserIds);

      return { markedCount: newUserIds.length };
    }),
    createUser: adminProcedure
      .input(
        adminCreateUserSchema.extend({
          confirmedLeadLink: z.boolean().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { createUser, linkPropertyOwnersToUserByCpf } = await import("./db");
        await ensureUniqueUserIdentity(input.email, input.cpf);
        const leadLinkPreview = await getLeadLinkPreviewByCpf(input.cpf);

        if (leadLinkPreview && !input.confirmedLeadLink) {
          const interestLabel = leadLinkPreview.latestInterest || "Interesse nao informado";
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Esse usuario ja e um lead e tem interesse em: ${interestLabel}. O sistema vinculara o acesso de usuario ao lead.`,
          });
        }

        const passwordHash = await hashPassword(input.password);
        const normalizedCreci = input.role === "corretor" ? normalizeOptionalCreci(input.creci) : undefined;
        const createdUser = await createUser({
          openId: `local:${nanoid()}`,
          name: input.name.trim(),
          email: input.email,
          cpf: input.cpf,
          creci: normalizedCreci || null,
          creciStatus: normalizedCreci ? "verified" : null,
          creciVerifiedAt: normalizedCreci ? new Date() : null,
          creciVerifiedByUserId: normalizedCreci ? ctx.user.id : null,
          loginMethod: "password",
          passwordHash,
          registrationSource: "admin_created",
          role: input.role,
          isActive: 1,
        });
        const linkedLeadPreview = await linkUserToExistingLeadsByCpf(createdUser.id, input.cpf);
        await linkPropertyOwnersToUserByCpf(createdUser.id, input.cpf);

        void sendWelcomeEmail({
          user: createdUser,
          req: ctx.req,
        }).catch(error => {
          console.error("[Email] Falha ao enviar boas-vindas para novo usuario criado pelo admin", error);
        });

        return {
          user: toSafeUser(createdUser),
          linkedLeadPreview,
        };
      }),
    updateUser: adminProcedure.input(adminUpdateUserSchema).mutation(async ({ ctx, input }) => {
      const { getUserById, updateUser } = await import("./db");
      const actingUser = await getUserById(ctx.user.id);
      const targetUser = await getUserById(input.id);

      if (!actingUser) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Usuario administrador nao encontrado" });
      }
      if (!targetUser) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Usuario nao encontrado" });
      }

      const actingIsRoot = isRootAdmin(actingUser);
      const targetIsRoot = isRootAdmin(targetUser);
      const isRootPasswordOnlyUpdate =
        targetIsRoot &&
        targetUser.id === ctx.user.id &&
        input.password !== undefined &&
        input.name === undefined &&
        input.role === undefined &&
        input.isActive === undefined;

      if (targetIsRoot && !isRootPasswordOnlyUpdate) {
        assertRootAdminMutable(targetUser);
      }

      if (ctx.user.id === targetUser.id && input.isActive === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Voce nao pode desativar sua propria conta" });
      }

      if (
        targetUser.role === "administrativo" &&
        targetUser.id !== ctx.user.id &&
        !actingIsRoot
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Apenas o proprio administrador ou o admin principal podem editar contas administrativas",
        });
      }

      const updatePayload: Record<string, unknown> = {};

      if (input.name !== undefined) {
        updatePayload.name = input.name.trim();
      }
      if (input.role !== undefined) {
        updatePayload.role = input.role;
      }
      if (input.isActive !== undefined) {
        updatePayload.isActive = input.isActive;
      }
      if (input.password) {
        updatePayload.passwordHash = await hashPassword(input.password);
        updatePayload.loginMethod = "password";
      }

      await updateUser(input.id, updatePayload);

      const updatedUser = await getUserById(input.id);
      if (!updatedUser) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Usuario nao encontrado" });
      }

      return toSafeUser(updatedUser);
    }),
    validateCreci: adminProcedure
      .input(adminValidateCreciSchema)
      .mutation(async ({ ctx, input }) => {
        const { getUserById, updateUser } = await import("./db");
        const user = await getUserById(input.userId);

        if (!user) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Usuario nao encontrado" });
        }

        if (user.role !== "corretor") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Somente corretores possuem CRECI" });
        }

        if (!user.creci || !isValidCreci(user.creci)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Cadastre um CRECI valido antes de validar" });
        }

        await updateUser(input.userId, {
          creci: normalizeCreci(user.creci),
          creciStatus: "verified",
          creciVerifiedAt: new Date(),
          creciVerifiedByUserId: ctx.user.id,
        });

        const updatedUser = await getUserById(input.userId);
        if (!updatedUser) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Usuario nao encontrado" });
        }

        return toSafeUser(updatedUser);
      }),
    deleteUserPreview: adminProcedure
      .input(adminDeleteUserPreviewSchema)
      .query(async ({ ctx, input }) => {
        const { getLeadsByUserId, getUserById } = await import("./db");
        const actingUser = await getUserById(ctx.user.id);
        const targetUser = await getUserById(input.userId);

        if (!actingUser) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Usuario administrador nao encontrado" });
        }
        if (!targetUser) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Usuario nao encontrado" });
        }

        const actingIsRoot = isRootAdmin(actingUser);
        const targetIsRoot = isRootAdmin(targetUser);

        if (targetIsRoot) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "O admin principal do sistema nao pode ser excluido",
          });
        }

        if (targetUser.role === "administrativo" && targetUser.id !== ctx.user.id && !actingIsRoot) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Apenas o admin principal pode excluir outros administradores",
          });
        }

        const linkedLeads = await getLeadsByUserId(targetUser.id);

        return {
          mode: targetUser.role === "administrativo" ? "revoke_access" : "delete_user",
          isSelf: targetUser.id === ctx.user.id,
          user: toSafeUser(targetUser),
          linkedLeads: linkedLeads.map(lead => ({
            id: lead.id,
            nome: lead.nome,
            interesse: lead.interesse,
            origem: lead.origem,
            status: lead.status,
            createdAt: lead.createdAt,
          })),
        };
      }),
    deleteUser: adminProcedure.input(adminDeleteUserSchema).mutation(async ({ ctx, input }) => {
      const {
        deleteLeadsByUserId,
        deleteUserById,
        getLeadsByUserId,
        getUserById,
        revokeUserAccess,
        unlinkLeadsFromUser,
      } = await import("./db");
      const actingUser = await getUserById(ctx.user.id);
      const targetUser = await getUserById(input.userId);

      if (!actingUser) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Usuario administrador nao encontrado" });
      }
      if (!targetUser) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Usuario nao encontrado" });
      }

      const actingIsRoot = isRootAdmin(actingUser);
      const targetIsRoot = isRootAdmin(targetUser);

      if (targetIsRoot) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "O admin principal do sistema nao pode ser excluido",
        });
      }

      const linkedLeads = await getLeadsByUserId(targetUser.id);

      if (targetUser.role === "administrativo") {
        if (targetUser.id !== ctx.user.id && !actingIsRoot) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Apenas o admin principal pode excluir outros administradores",
          });
        }

        await revokeUserAccess(targetUser.id);

        if (targetUser.id === ctx.user.id) {
          clearSessionCookie(ctx);
        }

        return {
          mode: "revoke_access" as const,
          isSelf: targetUser.id === ctx.user.id,
          deletedLeadCount: 0,
          unlinkedLeadCount: linkedLeads.length,
        };
      }

      if (input.deleteLinkedLeads) {
        await deleteLeadsByUserId(targetUser.id);
      } else if (linkedLeads.length > 0) {
        await unlinkLeadsFromUser(targetUser.id);
      }

      await deleteUserById(targetUser.id);

      return {
        mode: "delete_user" as const,
        isSelf: targetUser.id === ctx.user.id,
        deletedLeadCount: input.deleteLinkedLeads ? linkedLeads.length : 0,
        unlinkedLeadCount: input.deleteLinkedLeads ? 0 : linkedLeads.length,
      };
    }),
    updateUserDetails: adminProcedure
      .input(adminUserDetailsSchema)
      .mutation(async ({ ctx, input }) => {
        const { getUserById, linkPropertyOwnersToUserByCpf, updateUser } = await import("./db");
        const actingUser = await getUserById(ctx.user.id);
        const user = await getUserById(input.id);

        if (!actingUser) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Usuario administrador nao encontrado" });
        }
        if (!user) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Usuario nao encontrado" });
        }

        const actingIsRoot = isRootAdmin(actingUser);
        const targetIsRoot = isRootAdmin(user);

        if (targetIsRoot) {
          assertRootAdminMutable(user);
        }

        if (
          user.role === "administrativo" &&
          user.id !== ctx.user.id &&
          !actingIsRoot
        ) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Apenas o proprio administrador ou o admin principal podem editar contas administrativas",
          });
        }

        await ensureUniqueUserIdentity(input.email, input.cpf, input.id);
        const normalizedCreci = input.role === "corretor" ? normalizeOptionalCreci(input.creci) : undefined;

        await updateUser(input.id, {
          name: input.name.trim(),
          email: input.email,
          cpf: input.cpf,
          role: input.role,
          isActive: input.isActive,
          phone: input.phone?.trim() || null,
          creci: input.role === "corretor" ? normalizedCreci || null : null,
          creciStatus: input.role === "corretor" && normalizedCreci ? "verified" : null,
          creciVerifiedAt: input.role === "corretor" && normalizedCreci ? new Date() : null,
          creciVerifiedByUserId:
            input.role === "corretor" && normalizedCreci ? ctx.user.id : null,
          birthDate: input.birthDate ? new Date(`${input.birthDate}T00:00:00`) : null,
          profession: input.profession?.trim() || null,
          grossMonthlyIncome: input.grossMonthlyIncome ?? null,
          maritalStatus: input.maritalStatus ?? null,
          householdIncome: input.householdIncome ?? null,
          rg: input.rg?.trim() || null,
          nationality: input.nationality?.trim() || null,
          address: input.address?.trim() || null,
          neighborhood: input.neighborhood?.trim() || null,
          addressNumber: input.addressNumber?.trim() || null,
          city: input.city?.trim() || null,
          state: input.state?.trim() || null,
          zipCode: input.zipCode?.trim() || null,
          notes: input.notes?.trim() || null,
        });
        await linkUserToExistingLeadsByCpf(input.id, input.cpf);
        await linkPropertyOwnersToUserByCpf(input.id, input.cpf);

        const updatedUser = await getUserById(input.id);
        if (!updatedUser) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Usuario nao encontrado" });
        }

        return toSafeUser(updatedUser);
      }),
    updatePropertyOwnerDetails: adminProcedure
      .input(propertyOwnerDetailsSchema)
      .mutation(async ({ input }) => {
        const { getPropertyOwnerByCpf, getPropertyOwnersByEmail, getUserByCpf, updatePropertyOwner } = await import("./db");
        const duplicatedOwner = await getPropertyOwnerByCpf(input.cpf);

        if (duplicatedOwner && duplicatedOwner.id !== input.id) {
          throw new TRPCError({ code: "CONFLICT", message: "CPF ja cadastrado para outro proprietario" });
        }

        const ownersWithSameEmail = await getPropertyOwnersByEmail(input.email);
        const emailConflict = ownersWithSameEmail.find(owner => owner.id !== input.id && owner.cpf !== input.cpf);

        if (emailConflict) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              `OWNER_EMAIL_CONFLICT::Ja existe um proprietario com este e-mail vinculado a outro CPF: ` +
              `${emailConflict.name} (${emailConflict.cpf}).`,
          });
        }

        const linkedUser = await getUserByCpf(input.cpf);

        return await updatePropertyOwner(input.id, {
          name: input.name.trim(),
          email: input.email,
          cpf: input.cpf,
          phone: input.phone.trim(),
          notes: input.notes?.trim() || null,
          userId: linkedUser?.id ?? null,
        });
      }),
    updateUserRole: adminProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          role: z.enum(APP_ROLES),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { getUserById, updateUserRole } = await import("./db");
        const actingUser = await getUserById(ctx.user.id);
        const targetUser = await getUserById(input.id);

        if (!actingUser) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Usuario administrador nao encontrado" });
        }
        if (targetUser && isRootAdmin(targetUser) && input.role !== "administrativo") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "O admin principal do sistema nao pode perder permissao",
          });
        }
        if (
          targetUser?.role === "administrativo" &&
          targetUser.id !== ctx.user.id &&
          !isRootAdmin(actingUser)
        ) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Apenas o admin principal pode alterar outros administradores",
          });
        }

        return await updateUserRole(input.id, input.role);
      }),
  }),
});

export type AppRouter = typeof appRouter;

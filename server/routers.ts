import { APP_ROLES } from "@shared/auth";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import {
  CONTRACT_PARTICIPANT_ROLES,
  CONTRACT_TEMPLATE_KINDS,
  CONTRACT_VARIABLE_FIELD_MAP,
  normalizeContractVariableLabel,
} from "@shared/contract-variables";
import { buildRentalProposalReferenceCode } from "@shared/contract-reference";
import {
  buildBoletoDueDate,
  buildRentalBoletoSchedule,
  calculateBoletoTotal,
} from "@shared/rental-boletos";
import {
  CONTRACT_REQUIRED_USER_FIELDS,
  USER_PROFILE_MARITAL_STATUSES,
} from "@shared/user-profile";
import { TRPCError } from "@trpc/server";
import mammoth from "mammoth";
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

const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(255),
    auth: z.string().min(1).max(255),
  }),
  userAgent: z.string().max(255).optional(),
});

/**
 * Notifica o corretor responsável de que um novo lead foi direcionado a ele.
 * Nunca lança: push é um canal best-effort e não pode quebrar o fluxo do lead.
 */
async function notifyBrokerLeadAssigned(
  brokerUserId: number,
  leadName: string | null | undefined,
  leadId: number
) {
  const title = "Novo Lead";
  const body = leadName
    ? `O Lead ${leadName} foi direcionado para o seu Atendimento`
    : "Um novo Lead foi direcionado para o seu Atendimento";
  const url = "/crm";

  // Persiste no histórico primeiro (alimenta o sino mesmo se o push falhar).
  try {
    const { createUserNotification } = await import("./db");
    await createUserNotification({ userId: brokerUserId, title, body, url });
  } catch (error) {
    console.warn("[notify] Falha ao salvar histórico de notificação:", error);
  }

  try {
    const { sendPushToUser } = await import("./_core/push");
    await sendPushToUser(brokerUserId, {
      title,
      body,
      url,
      tag: `lead-${leadId}`,
    });
  } catch (error) {
    console.warn("[push] Falha ao notificar corretor do lead:", error);
  }
}

/**
 * Notifica (somente push) um usuário de que uma tarefa/evento foi atribuída a
 * ele. Não grava no histórico do sino de propósito: o indicador visual de
 * tarefas/eventos é o badge do ícone de calendário.
 */
function formatTaskDueAt(dueAt: Date | string | null | undefined): string | null {
  if (!dueAt) return null;
  const date = dueAt instanceof Date ? dueAt : new Date(dueAt);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(date)
    .replace(", ", " às ");
}

async function notifyUserTaskAssigned(
  userId: number,
  kind: string,
  taskTitle: string,
  taskId: number,
  dueAt: Date | string | null | undefined
) {
  const isEvent = kind === "evento";
  const when = formatTaskDueAt(dueAt);
  let body = `${isEvent ? "Evento" : "Tarefa"}: ${taskTitle}`;
  if (when) {
    body += isEvent ? ` — ${when}` : ` — vence em ${when}`;
  }
  try {
    const { sendPushToUser } = await import("./_core/push");
    await sendPushToUser(userId, {
      title: isEvent ? "Novo Evento" : "Nova Tarefa",
      body,
      url: "/tarefas-eventos",
      tag: `task-${taskId}`,
    });
  } catch (error) {
    console.warn("[push] Falha ao notificar tarefa/evento:", error);
  }
}

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

const contractTemplateTextVariableSchema = z.object({
  id: z.string().trim().min(1).max(80),
  start: z.number().int().min(0),
  end: z.number().int().min(0),
  placeholder: z.string().trim().min(1).max(160),
  label: z.string().trim().min(1).max(120),
  key: z.string().trim().min(1).max(120).nullable().optional(),
});

const contractTemplateDocxSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(160),
  dataUrl: z.string().trim().min(1).max(20_000_000),
});

const listContractTemplatesSchema = z
  .object({
    contractKind: z.enum(CONTRACT_TEMPLATE_KINDS).optional(),
  })
  .optional();

const createContractTemplateSchema = z.object({
  name: z.string().trim().min(2).max(180),
  notes: z.string().trim().max(3000).optional(),
  contractKind: z.enum(CONTRACT_TEMPLATE_KINDS).default("locacao"),
  participantRoles: z
    .array(z.enum(CONTRACT_PARTICIPANT_ROLES))
    .min(1)
    .max(CONTRACT_PARTICIPANT_ROLES.length),
  originalFileName: z.string().trim().min(1).max(255),
  originalMimeType: z.string().trim().min(1).max(160),
  originalFileData: z.string().trim().min(1).max(20_000_000),
  extractedText: z.string().trim().min(1),
  reviewedText: z.string().trim().min(1),
  variableHighlights: z.array(contractTemplateTextVariableSchema).max(200),
});

const updateContractTemplateSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(2).max(180),
  notes: z.string().trim().max(3000).optional(),
  contractKind: z.enum(CONTRACT_TEMPLATE_KINDS).optional(),
  participantRoles: z
    .array(z.enum(CONTRACT_PARTICIPANT_ROLES))
    .min(1)
    .max(CONTRACT_PARTICIPANT_ROLES.length)
    .optional(),
  reviewedText: z.string().trim().min(1),
  variableHighlights: z.array(contractTemplateTextVariableSchema).max(200),
});

const createRentalProposalSchema = z.object({
  propertyId: z.number().int().positive(),
  brokerUserId: z.number().int().positive(),
  tenantUserId: z.number().int().positive(),
  tenantUserIds: z.array(z.number().int().positive()).min(1).max(10).optional(),
  ownerIds: z.array(z.number().int().positive()).min(1).max(3).optional(),
  ownerConfirmed: z.boolean(),
  tenantConfirmed: z.boolean(),
  leaseTermMonths: z.number().int().min(1).max(120),
  adjustmentIndex: z.string().trim().min(2).max(40),
  adjustmentPeriod: z.enum(["anual", "mensal"]),
  administrationFeePercent: z.number().int().min(0).max(10000),
  transferBusinessDays: z.number().int().min(0).max(60),
  terminationPenaltyType: z.enum(["valor", "alugueis"]),
  terminationPenaltyAmount: z.number().int().min(1),
  rentAmount: z.number().int().min(1),
  condominiumAmount: z.number().int().min(0).nullable().optional(),
  startDate: z.string().trim().min(10).max(10),
  dueDay: z.number().int().min(1).max(31),
  notes: z.string().trim().max(3000).optional(),
});

const updateRentalProposalSchema = createRentalProposalSchema.extend({
  id: z.number().int().positive(),
});

const selectRentalProposalContractTemplatesSchema = z.object({
  id: z.number().int().positive(),
  contractTemplateIds: z.array(z.number().int().positive()).min(1).max(10),
});

const updateRentalProposalGeneratedContractTextSchema = z.object({
  contractId: z.number().int().positive(),
  reviewedText: z.string().trim().min(1).max(1_000_000),
});

const approveRentalProposalGeneratedContractSchema = z.object({
  contractId: z.number().int().positive(),
});

const regenerateRentalProposalGeneratedContractSchema = z.object({
  contractId: z.number().int().positive(),
});

const optionalDateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data invalida.");

const updateRentalProposalBoletoSchema = z.object({
  boletoId: z.number().int().positive(),
  dueDate: optionalDateStringSchema.optional(),
  rentAmount: z.number().int().min(0).max(1_000_000_000).optional(),
  condominiumAmount: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
  extraAmount: z.number().int().min(0).max(1_000_000_000).optional(),
  extraDescription: z.string().trim().max(180).nullable().optional(),
  notes: z.string().trim().max(2_000).nullable().optional(),
});

const updateRentalProposalBoletosBatchSchema = z.object({
  id: z.number().int().positive(),
  boletoIds: z.array(z.number().int().positive()).max(600).optional(),
  patch: z
    .object({
      dueDay: z.number().int().min(1).max(31).optional(),
      rentAmount: z.number().int().min(0).max(1_000_000_000).optional(),
      condominiumAmount: z
        .number()
        .int()
        .min(0)
        .max(1_000_000_000)
        .nullable()
        .optional(),
      extraAmount: z.number().int().min(0).max(1_000_000_000).optional(),
      extraDescription: z.string().trim().max(180).nullable().optional(),
    })
    .refine(patch => Object.keys(patch).length > 0, {
      message: "Informe ao menos um campo para atualizar em lote.",
    }),
});

function uniquePositiveIds(ids: number[]) {
  return Array.from(new Set(ids.filter(id => Number.isInteger(id) && id > 0)));
}

const propertyPhotoUploadSchema = z.object({
  fileName: z.string().trim().max(255).optional(),
  dataUrl: z.string().trim().min(1).max(30_000_000),
});

const propertyUploadedPhotoDeleteSchema = z.object({
  url: z.string().trim().min(1).max(500),
});

const propertyOwnerInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  cpf: cpfSchema.optional().or(z.literal("").transform(() => undefined)),
  phone: z.string().trim().min(14).max(20),
  notes: z.string().trim().max(2000).optional(),
});

const quickPropertyOwnerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  cpf: cpfSchema,
});

const condominiumTypeSchema = z.enum(["casa", "apartamento"]);

const propertyMutationSchema = z
  .object({
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
    parceria: z.boolean().optional(),
    parceriaNome: z.string().trim().max(160).nullable().optional(),
    parceriaTelefone: z.string().trim().max(20).nullable().optional(),
    parceriaReferencia: z.string().trim().max(120).nullable().optional(),
    owner: propertyOwnerInputSchema.optional(),
    owners: z.array(propertyOwnerInputSchema).min(1).max(3).optional(),
    confirmedOwnerEmailConflict: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.parceria === true) {
      if (!value.parceriaNome?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["parceriaNome"],
          message: "Informe o nome da imobiliaria parceira.",
        });
      }

      if (!value.parceriaTelefone?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["parceriaTelefone"],
          message: "Informe o telefone da imobiliaria parceira.",
        });
      }
      return;
    }

    if (!value.owner && (!value.owners || value.owners.length === 0)) {
      ctx.addIssue({
        code: "custom",
        path: ["owner"],
        message: "Informe ao menos um proprietario.",
      });
    }
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

const propertyLaunchMutationSchema = z.object({
  nome: z.string().trim().min(2).max(180),
  descricao: z.string().trim().max(5000).nullable().optional(),
  construtora: z.string().trim().max(160).nullable().optional(),
  tipo: z.string().trim().min(2).max(50),
  status: z.string().trim().min(2).max(30).optional(),
  entregaPrevista: z.string().trim().max(10).nullable().optional(),
  valorMin: z.number().int().min(0),
  valorMax: z.number().int().min(0).nullable().optional(),
  areaMin: z.number().int().min(0).nullable().optional(),
  areaMax: z.number().int().min(0).nullable().optional(),
  quartosMin: z.number().int().min(0).nullable().optional(),
  quartosMax: z.number().int().min(0).nullable().optional(),
  vagasMin: z.number().int().min(0).nullable().optional(),
  vagasMax: z.number().int().min(0).nullable().optional(),
  unidadesDisponiveis: z.number().int().min(0).nullable().optional(),
  endereco: z.string().trim().min(2).max(255),
  numero: z.string().trim().max(20).nullable().optional(),
  bairro: z.string().trim().max(100).nullable().optional(),
  cidade: z.string().trim().min(2).max(100),
  estado: z.string().trim().min(2).max(2),
  cep: z.string().trim().max(10).nullable().optional(),
  fotos: z.string().trim().nullable().optional(),
  destaque: z.number().int().min(0).max(1).optional(),
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

const integrationCategorySchema = z.enum([
  "portal_divulgacao",
  "financeiro",
  "assinaturas_eletronicas",
  "automacao",
  "outro",
]);
const integrationConnectionTypeSchema = z.enum([
  "api",
  "webhook",
  "arquivo",
  "manual",
]);
const integrationStatusSchema = z.enum(["rascunho", "ativo", "inativo"]);

const integrationMutationSchema = z.object({
  name: z.string().trim().min(2).max(140),
  category: integrationCategorySchema,
  provider: z.string().trim().min(2).max(120),
  connectionType: integrationConnectionTypeSchema,
  status: integrationStatusSchema.default("rascunho"),
  endpoint: z.string().trim().max(1000).nullable().optional(),
  apiKey: z.string().trim().max(3000).nullable().optional(),
  configJson: z
    .string()
    .trim()
    .max(10000)
    .nullable()
    .optional()
    .refine(value => {
      if (!value) return true;
      try {
        JSON.parse(value);
        return true;
      } catch {
        return false;
      }
    }, "Informe um JSON valido nas configuracoes."),
  notes: z.string().trim().max(3000).nullable().optional(),
});

const listIntegrationsSchema = z.object({
  category: integrationCategorySchema.optional(),
  status: integrationStatusSchema.optional(),
});

const updateIntegrationSchema = integrationMutationSchema.extend({
  id: z.number().int().positive(),
});

const updateIntegrationStatusSchema = z.object({
  id: z.number().int().positive(),
  status: integrationStatusSchema,
});

const createPropertySchema = propertyMutationSchema;

const updatePropertySchema = propertyMutationSchema.safeExtend({
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

const propertyKeyStatusSchema = z.enum([
  "disponivel",
  "retirada",
  "indisponivel",
]);

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

const taskKindSchema = z.enum(["tarefa", "evento"]);
const taskSectorSchema = z.enum([
  "administrativo",
  "financeiro",
  "atendimento",
  "comercial",
  "juridico",
]);
const taskPersistedStatusSchema = z.enum(["pendente", "em_andamento"]);
const taskEditableStatusSchema = z.enum([
  "pendente",
  "em_andamento",
  "atrasado",
  "concluida",
]);

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
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Imóvel não encontrado",
    });
  }

  return property;
}

async function ensurePropertyManagementAccess(
  user: { id: number; role: "cliente" | "corretor" | "administrativo" },
  propertyId: number
) {
  const property = await ensurePropertyExists(propertyId);

  if (user.role === "cliente") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Voce nao tem acesso a este imovel",
    });
  }

  if (user.role === "corretor" && property.idCorretor !== user.id) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Voce nao tem permissao para gerenciar este imovel",
    });
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
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Você não tem acesso a este lead",
    });
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

function decodeDocxDataUrl(dataUrl: string) {
  const match = dataUrl.match(
    /^data:(application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|application\/octet-stream);base64,([A-Za-z0-9+/=\s]+)$/
  );
  if (!match) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Arquivo DOCX invalido.",
    });
  }

  const buffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (buffer.length === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Arquivo DOCX vazio.",
    });
  }

  if (buffer.length > 12 * 1024 * 1024) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "O DOCX deve ter no maximo 12 MB.",
    });
  }

  return buffer;
}

async function extractDocxTextFromDataUrl(dataUrl: string) {
  const result = await mammoth.extractRawText({
    buffer: decodeDocxDataUrl(dataUrl),
  });
  const text = result.value
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!text) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Nao foi possivel extrair texto deste DOCX.",
    });
  }

  return text;
}

function detectContractTemplateVariables(text: string) {
  const variables: Array<{
    id: string;
    start: number;
    end: number;
    placeholder: string;
    label: string;
    key: string | null;
  }> = [];

  for (const match of Array.from(text.matchAll(/\[([^\[\]\n]{2,120})\]/g))) {
    if (typeof match.index !== "number" || !match[0]) continue;
    const label = (match[1] || "").trim();
    if (!label) continue;

    variables.push({
      id: nanoid(10),
      start: match.index,
      end: match.index + match[0].length,
      placeholder: match[0],
      label,
      key:
        CONTRACT_VARIABLE_FIELD_MAP[normalizeContractVariableLabel(label)] ??
        null,
    });
  }

  return variables.slice(0, 200);
}

type ContractTemplateVariable = {
  placeholder: string;
  label: string;
  key?: string | null;
};

function parseContractTemplateVariables(value: string | null | undefined) {
  try {
    const parsed = JSON.parse(value || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is ContractTemplateVariable =>
        typeof item === "object" &&
        item !== null &&
        typeof item.placeholder === "string" &&
        typeof item.label === "string"
    );
  } catch {
    return [];
  }
}

function parseRecord(value: string | null | undefined): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getNestedValue(source: Record<string, unknown>, path: string) {
  return path.split(".").reduce<unknown>((current, segment) => {
    const record = asRecord(current);
    return record ? record[segment] : undefined;
  }, source);
}

function formatCurrencyFromCents(value: unknown) {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) return "";
  return (amount / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

// administrationFeePercent guarda pontos-base de 2 casas (10,00% = 1000).
function formatPercentFromBasisPoints(value: unknown) {
  if (value === null || value === undefined || value === "") return "";
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) return "";
  return `${(amount / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function formatTerminationPenalty(type: unknown, amount: unknown) {
  const value = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(value)) return "";
  if (type === "alugueis") {
    return `${value} ${value === 1 ? "aluguel" : "aluguéis"}`;
  }
  if (type === "valor") {
    return formatCurrencyFromCents(value);
  }
  return "";
}

function formatDatePtBr(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function addMonthsToDate(value: unknown, months: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  const term = typeof months === "number" ? months : Number(months);
  if (Number.isNaN(date.getTime()) || !Number.isFinite(term)) return "";
  date.setUTCMonth(date.getUTCMonth() + term);
  return date.toISOString().slice(0, 10);
}

function joinAddress(parts: Array<unknown>) {
  return parts
    .map(part => (part === null || part === undefined ? "" : String(part).trim()))
    .filter(Boolean)
    .join(", ");
}

function formatPersonVariableSource(person: Record<string, unknown>) {
  const address = joinAddress([
    person.address,
    person.addressNumber,
    person.neighborhood,
    person.city,
    person.state,
    person.zipCode,
  ]);

  return {
    nome: person.name,
    cpf: person.cpf,
    rg: person.rg,
    email: person.email,
    telefone: person.phone,
    birthDate: formatDatePtBr(person.birthDate),
    profession: person.profession,
    maritalStatus: person.maritalStatus,
    nacionalidade: person.nationality,
    grossMonthlyIncome: formatCurrencyFromCents(person.grossMonthlyIncome),
    householdIncome: formatCurrencyFromCents(person.householdIncome),
    endereco: address || person.address,
    addressNumber: person.addressNumber,
    bairro: person.neighborhood,
    cidade: person.city,
    estado: person.state,
    zipCode: person.zipCode,
    observacoes: person.notes,
  };
}

function buildRentalProposalVariableSource(
  contextSnapshot: Record<string, unknown>
) {
  const property = asRecord(contextSnapshot.property) ?? {};
  const broker = asRecord(contextSnapshot.broker) ?? {};
  const tenant = asRecord(contextSnapshot.tenant) ?? {};
  const owner = asRecord(contextSnapshot.owner) ?? {};
  const lease = asRecord(contextSnapshot.lease) ?? {};
  const startDate = lease.startDate;
  const endDate = addMonthsToDate(startDate, lease.leaseTermMonths);

  const address = joinAddress([
    property.endereco,
    property.address,
    property.numero,
    property.addressNumber,
    property.bairro,
    property.cidade,
    property.estado,
  ]);
  const tenantSource = formatPersonVariableSource(tenant);
  const ownerSource = formatPersonVariableSource(owner);

  return {
    locatario: tenantSource,
    comprador: tenantSource,
    proprietario: ownerSource,
    vendedor: ownerSource,
    corretor: {
      nome: broker.name,
      email: broker.email,
      telefone: broker.phone,
      creci: broker.creci,
    },
    imovel: {
      titulo: property.titulo,
      enderecoCompleto: address,
      endereco: property.endereco ?? property.address,
      numero: property.numero ?? property.addressNumber,
      bairro: property.bairro,
      cidade: property.cidade,
      estado: property.estado,
      cep: property.cep,
      valorVenda: formatCurrencyFromCents(property.valor),
      valorLocacao: formatCurrencyFromCents(property.valorLocacao),
      valorCondominio: formatCurrencyFromCents(
        asRecord(property.condominio)?.valorCondominio
      ),
      valorIptu: formatCurrencyFromCents(asRecord(property.condominio)?.valorIptu),
    },
    locacao: {
      valorAluguel: formatCurrencyFromCents(lease.rentAmount),
      valorCondominio: lease.condominiumAmount
        ? formatCurrencyFromCents(lease.condominiumAmount)
        : "",
      dataInicio: formatDatePtBr(startDate),
      dataFim: formatDatePtBr(endDate),
      prazo: lease.leaseTermMonths ? `${lease.leaseTermMonths} meses` : "",
      diaVencimento: lease.dueDay,
      indiceReajuste: lease.adjustmentIndex,
      tempoReajuste:
        lease.adjustmentPeriod === "mensal"
          ? "Mensal"
          : lease.adjustmentPeriod === "anual"
            ? "Anual"
            : "",
      taxaAdministracao: formatPercentFromBasisPoints(
        lease.administrationFeePercent
      ),
      diasUteisRepasse:
        lease.transferBusinessDays === null ||
        lease.transferBusinessDays === undefined
          ? ""
          : String(lease.transferBusinessDays),
      multaRescisoria: formatTerminationPenalty(
        lease.terminationPenaltyType,
        lease.terminationPenaltyAmount
      ),
      observacoes: lease.notes,
    },
  };
}

function applyRentalProposalVariables(
  text: string,
  variables: ContractTemplateVariable[],
  variableSource: Record<string, unknown>
) {
  let generatedText = text;
  const variableValues: Record<string, string> = {};
  const unresolvedVariables: Array<{
    placeholder: string;
    label: string;
    key: string | null;
  }> = [];

  for (const variable of variables) {
    const key = variable.key || null;
    const value = key ? getNestedValue(variableSource, key) : undefined;
    const stringValue =
      value === null || value === undefined ? "" : String(value).trim();

    if (!key || !stringValue) {
      unresolvedVariables.push({
        placeholder: variable.placeholder,
        label: variable.label,
        key,
      });
      continue;
    }

    variableValues[variable.placeholder] = stringValue;
    generatedText = generatedText.split(variable.placeholder).join(stringValue);
  }

  return { generatedText, variableValues, unresolvedVariables };
}

// Reconciliacao da etapa de contratos: se todos os contratos estiverem
// aprovados, garante o codigo de referencia e avanca para boletos; caso
// contrario (ex.: novo modelo adicionado), reabre a revisao.
async function reconcileRentalProposalContractStage(proposalId: number) {
  const {
    getRentalProposalById,
    setRentalProposalReferenceCode,
    updateRentalProposal,
  } = await import("./db");

  const proposal = await getRentalProposalById(proposalId);
  if (!proposal) return { referenceCode: null, allApproved: false } as const;

  const contracts = proposal.generatedContracts ?? [];

  // Sem contratos: volta para a etapa de escolha de modelos.
  if (contracts.length === 0) {
    if (proposal.currentStep !== "modelos_contrato") {
      await updateRentalProposal(proposal.id, {
        status: "rascunho",
        currentStep: "modelos_contrato",
      });
    }
    return {
      referenceCode: proposal.referenceCode ?? null,
      allApproved: false,
    } as const;
  }

  const allApproved = contracts.every(item => item.status === "aprovado");

  if (allApproved) {
    const referenceCode =
      proposal.referenceCode ?? buildRentalProposalReferenceCode(proposal.id);
    await setRentalProposalReferenceCode(proposal.id, referenceCode);
    return { referenceCode, allApproved } as const;
  }

  if (proposal.currentStep !== "contratos_em_revisao") {
    await updateRentalProposal(proposal.id, {
      status: "contratos_em_revisao",
      currentStep: "contratos_em_revisao",
    });
  }

  return { referenceCode: proposal.referenceCode ?? null, allApproved } as const;
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

  const inactiveIds = users
    .filter(user => user.isActive !== 1)
    .map(user => user.id);
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
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Tarefa/Evento nao encontrado",
    });
  }

  if (user.role === "administrativo") {
    return task;
  }

  const isCreator = task.createdByUserId === user.id;
  const isAssigned = task.assignees.some(assignee => assignee.id === user.id);

  if (!isCreator && !isAssigned) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Voce nao tem acesso a esta tarefa/evento",
    });
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

async function ensurePropertyResponsibleUser(userId: number) {
  const { getUserById } = await import("./db");
  const responsible = await getUserById(userId);

  if (!responsible || (responsible.role !== "corretor" && responsible.role !== "administrativo") || isRootAdmin(responsible)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Selecione um responsavel pelo imovel valido",
    });
  }

  if (responsible.isActive !== 1) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "O responsavel pelo imovel precisa estar ativo",
    });
  }

  return responsible;
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
  const allCondominiums = await listCondominiums({
    includeInactive: true,
    limit: 1000,
  });
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
      message:
        "Ja existe um condominio cadastrado com este nome na cidade informada.",
    });
  }
}

async function ensureCondominiumExists(id: number) {
  const { getCondominiumById } = await import("./db");
  const condominium = await getCondominiumById(id);

  if (!condominium) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Condominio nao encontrado.",
    });
  }

  return condominium;
}

async function ensureIntegrationExists(id: number) {
  const { getIntegrationById } = await import("./db");
  const integration = await getIntegrationById(id);

  if (!integration) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Integracao nao encontrada.",
    });
  }

  return integration;
}

function normalizeCondominiumFeatures(rawFeatures?: string[]) {
  if (!rawFeatures || rawFeatures.length === 0) return [] as string[];

  const normalized = rawFeatures.map(item => item.trim()).filter(Boolean);

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
    email: ownerInput.email?.trim().toLowerCase() || null,
    cpf: ownerInput.cpf || null,
    phone: ownerInput.phone.trim(),
    notes: ownerInput.notes?.trim() || null,
  };

  const ownersWithSameEmail = normalizedOwner.email
    ? await getPropertyOwnersByEmail(normalizedOwner.email)
    : [];
  const emailConflict = ownersWithSameEmail.find(owner => {
    if (owner.id === options?.currentOwnerId) return false;
    if (!normalizedOwner.cpf || !owner.cpf) return owner.email === normalizedOwner.email;
    return owner.cpf !== normalizedOwner.cpf;
  });

  if (emailConflict && !options?.confirmedEmailConflict) {
    throw new TRPCError({
      code: "CONFLICT",
      message:
        `OWNER_EMAIL_CONFLICT::Ja existe um proprietario com este e-mail vinculado a outro CPF: ` +
        `${emailConflict.name}${emailConflict.cpf ? ` (${emailConflict.cpf})` : ""}. Deseja continuar mesmo assim?`,
    });
  }

  const matchedUser = normalizedOwner.cpf ? await getUserByCpf(normalizedOwner.cpf) : undefined;
  const matchedOwner = normalizedOwner.cpf ? await getPropertyOwnerByCpf(normalizedOwner.cpf) : undefined;

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

async function upsertPropertyOwnersFromInput(
  ownerInputs: z.infer<typeof propertyOwnerInputSchema>[],
  options?: {
    currentOwnerIds?: number[];
    confirmedEmailConflict?: boolean;
  }
) {
  const owners = [];

  for (let index = 0; index < ownerInputs.length; index += 1) {
    const owner = await upsertPropertyOwnerFromInput(ownerInputs[index], {
      currentOwnerId: options?.currentOwnerIds?.[index],
      confirmedEmailConflict: options?.confirmedEmailConflict,
    });
    owners.push(owner);
  }

  const uniqueOwners = [];
  const seenIds = new Set<number>();
  for (const owner of owners) {
    if (seenIds.has(owner.id)) continue;
    seenIds.add(owner.id);
    uniqueOwners.push(owner);
  }

  if (uniqueOwners.length === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Informe ao menos um proprietario.",
    });
  }

  return uniqueOwners.slice(0, 3);
}

async function assertContractProfileIsComplete(userId: number) {
  const { getUserById } = await import("./db");
  const user = await getUserById(userId);

  if (!user) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Cliente não encontrado",
    });
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
  const { getUserById, getViewedUserIdsByAdmin, markUserAsViewedByAdmin } =
    await import("./db");
  const user = await getUserById(userId);

  if (!user) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Usuario nao encontrado",
    });
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
  notifications: router({
    config: protectedProcedure.query(async () => {
      const { getVapidPublicKey, isPushConfigured } = await import(
        "./_core/push"
      );
      return {
        enabled: isPushConfigured(),
        publicKey: getVapidPublicKey(),
      };
    }),
    subscribe: protectedProcedure
      .input(pushSubscriptionSchema)
      .mutation(async ({ ctx, input }) => {
        const { savePushSubscription } = await import("./db");
        await savePushSubscription({
          userId: ctx.user.id,
          endpoint: input.endpoint,
          p256dh: input.keys.p256dh,
          auth: input.keys.auth,
          userAgent: input.userAgent ?? null,
        });
        return { ok: true };
      }),
    unsubscribe: protectedProcedure
      .input(z.object({ endpoint: z.string().url().max(2048) }))
      .mutation(async ({ input }) => {
        const { deletePushSubscriptionByEndpoint } = await import("./db");
        await deletePushSubscriptionByEndpoint(input.endpoint);
        return { ok: true };
      }),
    sendTest: protectedProcedure.mutation(async ({ ctx }) => {
      const { createUserNotification } = await import("./db");
      await createUserNotification({
        userId: ctx.user.id,
        title: "Notificação de teste",
        body: "Se você recebeu isto, o push está funcionando! 🎉",
        url: "/dashboard",
      });
      const { sendPushToUser } = await import("./_core/push");
      const result = await sendPushToUser(ctx.user.id, {
        title: "Notificação de teste",
        body: "Se você recebeu isto, o push está funcionando! 🎉",
        url: "/dashboard",
        tag: "test-notification",
      });
      return result;
    }),
    history: protectedProcedure.query(async ({ ctx }) => {
      const { getUserNotifications, countUnreadUserNotifications } =
        await import("./db");
      const [items, unreadCount] = await Promise.all([
        getUserNotifications(ctx.user.id, 30),
        countUnreadUserNotifications(ctx.user.id),
      ]);
      return { items, unreadCount };
    }),
    markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
      const { markUserNotificationsRead } = await import("./db");
      await markUserNotificationsRead(ctx.user.id);
      return { ok: true };
    }),
    markRead: protectedProcedure
      .input(idSchema)
      .mutation(async ({ ctx, input }) => {
        const { markUserNotificationRead } = await import("./db");
        await markUserNotificationRead(input.id, ctx.user.id);
        return { ok: true };
      }),
  }),
  auth: router({
    register: publicProcedure
      .input(registerSchema)
      .mutation(async ({ ctx, input }) => {
        const { createUser, linkPropertyOwnersToUserByCpf } = await import(
          "./db"
        );
        await ensureUniqueUserIdentity(input.email, input.cpf);

        const passwordHash = await hashPassword(input.password);
        const createdUser = await createUser({
          openId: `local:${nanoid()}`,
          name: input.name.trim(),
          email: input.email,
          cpf: input.cpf,
          phone: input.phone.trim(),
          birthDate: input.birthDate
            ? new Date(`${input.birthDate}T00:00:00`)
            : null,
          loginMethod: "password",
          passwordHash,
          registrationSource: "public_signup",
          role: "cliente",
          isActive: 1,
          lastSignedIn: new Date(),
        });
        const linkedLeadPreview = await linkUserToExistingLeadsByCpf(
          createdUser.id,
          input.cpf
        );
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
          console.error(
            "[Email] Falha ao enviar boas-vindas para novo cliente",
            error
          );
        });

        return {
          user: toSafeUser(createdUser),
          linkedLeadPreview,
        };
      }),
    login: publicProcedure
      .input(loginSchema)
      .mutation(async ({ ctx, input }) => {
        const { getUserByEmail, upsertUser } = await import("./db");
        const user = await getUserByEmail(input.email);

        if (!user || !user.passwordHash) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "E-mail ou senha inválidos.",
          });
        }
        if (user.isActive !== 1) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Usuário Desativado. Contate o administrador.",
          });
        }

        const isPasswordValid = await verifyPassword(
          input.password,
          user.passwordHash
        );
        if (!isPasswordValid) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "E-mail ou senha inválidos.",
          });
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
    create: staffProcedure
      .input(createCondominiumSchema)
      .mutation(async ({ ctx, input }) => {
        const { createCondominium } = await import("./db");
        await ensureCondominiumUnique(input.nome, input.cidade);
        const normalizedFeatures = normalizeCondominiumFeatures(
          input.caracteristicas
        );

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
            normalizedFeatures.length > 0
              ? JSON.stringify(normalizedFeatures)
              : null,
          observacoes: input.observacoes ?? null,
          isAtivo: 1,
          createdByUserId: ctx.user.id,
        });
      }),
    update: staffProcedure
      .input(updateCondominiumSchema)
      .mutation(async ({ ctx, input }) => {
        const { updateCondominium } = await import("./db");
        await ensureCondominiumExists(input.id);
        await ensureCondominiumUnique(input.nome, input.cidade, input.id);
        const normalizedFeatures = normalizeCondominiumFeatures(
          input.caracteristicas
        );

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
            normalizedFeatures.length > 0
              ? JSON.stringify(normalizedFeatures)
              : null,
          observacoes: input.observacoes ?? null,
        });

        if (!updated) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Condominio nao encontrado.",
          });
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
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Condominio nao encontrado.",
          });
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

  integracoes: router({
    list: adminProcedure
      .input(listIntegrationsSchema.optional())
      .query(async ({ input }) => {
        const { listIntegrations } = await import("./db");
        return await listIntegrations({
          category: input?.category,
          status: input?.status,
        });
      }),
    create: adminProcedure
      .input(integrationMutationSchema)
      .mutation(async ({ ctx, input }) => {
        const { createIntegration } = await import("./db");

        return await createIntegration({
          name: input.name,
          category: input.category,
          provider: input.provider,
          connectionType: input.connectionType,
          status: input.status,
          endpoint: input.endpoint ?? null,
          apiKey: input.apiKey ?? null,
          configJson: input.configJson ?? null,
          notes: input.notes ?? null,
          createdByUserId: ctx.user.id,
        });
      }),
    update: adminProcedure
      .input(updateIntegrationSchema)
      .mutation(async ({ input }) => {
        const { updateIntegration } = await import("./db");
        await ensureIntegrationExists(input.id);

        const updated = await updateIntegration(input.id, {
          name: input.name,
          category: input.category,
          provider: input.provider,
          connectionType: input.connectionType,
          status: input.status,
          endpoint: input.endpoint ?? null,
          apiKey: input.apiKey ?? null,
          configJson: input.configJson ?? null,
          notes: input.notes ?? null,
        });

        if (!updated) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Integracao nao encontrada.",
          });
        }

        return updated;
      }),
    updateStatus: adminProcedure
      .input(updateIntegrationStatusSchema)
      .mutation(async ({ input }) => {
        const { updateIntegration } = await import("./db");
        await ensureIntegrationExists(input.id);

        const updated = await updateIntegration(input.id, {
          status: input.status,
        });

        if (!updated) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Integracao nao encontrada.",
          });
        }

        return updated;
      }),
  }),

  launches: router({
    list: publicProcedure.query(async () => {
      const { getActivePropertyLaunches } = await import("./db");
      return await getActivePropertyLaunches();
    }),
    create: staffProcedure
      .input(propertyLaunchMutationSchema)
      .mutation(async ({ ctx, input }) => {
        const { createPropertyLaunch } = await import("./db");

        const entregaPrevista = input.entregaPrevista
          ? new Date(`${input.entregaPrevista}T00:00:00`)
          : null;

        return await createPropertyLaunch({
          nome: input.nome,
          descricao: input.descricao ?? null,
          construtora: input.construtora ?? null,
          tipo: input.tipo,
          status: input.status ?? "lancamento",
          entregaPrevista,
          valorMin: input.valorMin,
          valorMax: input.valorMax ?? null,
          areaMin: input.areaMin ?? null,
          areaMax: input.areaMax ?? null,
          quartosMin: input.quartosMin ?? null,
          quartosMax: input.quartosMax ?? null,
          vagasMin: input.vagasMin ?? null,
          vagasMax: input.vagasMax ?? null,
          unidadesDisponiveis: input.unidadesDisponiveis ?? null,
          endereco: input.endereco,
          numero: input.numero ?? null,
          bairro: input.bairro ?? null,
          cidade: input.cidade,
          estado: input.estado,
          cep: input.cep ?? null,
          fotos: input.fotos ?? null,
          destaque: input.destaque ?? 0,
          isAtivo: 1,
          createdByUserId: ctx.user.id,
        });
      }),
  }),

  properties: router({
    list: publicProcedure
      .input(propertyListSchema.optional())
      .query(async ({ ctx, input }) => {
        const { getAllProperties } = await import("./db");
        const isAdmin = ctx.user?.role === "administrativo";
        const showDeletedOnly = isAdmin && input?.showDeletedOnly === true;
        return await getAllProperties({ deletedOnly: showDeletedOnly });
      }),
    getById: publicProcedure.input(idSchema).query(async ({ ctx, input }) => {
      const { getPropertyById, getPropertyByIdWithRelations } = await import(
        "./db"
      );
      if (!ctx.user || ctx.user.role === "cliente") {
        return await getPropertyById(input.id);
      }

      const propertyWithRelations = await getPropertyByIdWithRelations(
        input.id
      );
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
      const propertyWithRelations = await getPropertyByIdWithRelations(
        input.id,
        { includeDeleted: true }
      );

      if (!propertyWithRelations) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Imovel nao encontrado",
        });
      }

      return propertyWithRelations;
    }),
    getDestacados: publicProcedure.query(async () => {
      const { getDestacados } = await import("./db");
      return await getDestacados();
    }),
    myProperties: staffProcedure.query(async ({ ctx }) => {
      const { getAllPropertiesWithRelations, getPropertiesByCorretor } =
        await import("./db");
      if (ctx.user.role === "administrativo") {
        return await getAllPropertiesWithRelations();
      }
      return await getPropertiesByCorretor(ctx.user.id);
    }),
    create: staffProcedure
      .input(createPropertySchema)
      .mutation(async ({ ctx, input }) => {
        const { createProperty, findActivePropertyByCepAndNumber } =
          await import("./db");

        const idCorretor =
          ctx.user.role === "administrativo" ? input.idCorretor : ctx.user.id;

        if (!idCorretor) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Selecione o responsavel pelo imovel antes de cadastrar.",
          });
        }

        await ensurePropertyResponsibleUser(idCorretor);
        const isPartnership = input.parceria === true;
        const owners = isPartnership
          ? []
          : await upsertPropertyOwnersFromInput(
              input.owners?.length ? input.owners : [input.owner!],
              {
                confirmedEmailConflict: input.confirmedOwnerEmailConflict,
              }
            );
        const primaryOwner = owners[0] ?? null;
        const emCondominio = input.emCondominio === true;
        let idCondominio: number | null = emCondominio
          ? (input.idCondominio ?? null)
          : null;
        let tipoCondominio: z.infer<typeof condominiumTypeSchema> | null =
          emCondominio ? (input.tipoCondominio ?? null) : null;

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
              message:
                "O tipo selecionado nao corresponde ao tipo cadastrado no condominio.",
            });
          }
        } else {
          idCondominio = null;
          tipoCondominio = null;
        }

        const duplicateProperty = await findActivePropertyByCepAndNumber(
          input.cep,
          input.numero
        );
        if (duplicateProperty) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Ja existe um imovel ativo cadastrado neste CEP e numero: ${duplicateProperty.titulo}.`,
          });
        }

        return await createProperty(
          {
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
            parceria: isPartnership ? 1 : 0,
            parceriaNome: isPartnership
              ? input.parceriaNome?.trim() || null
              : null,
            parceriaTelefone: isPartnership
              ? input.parceriaTelefone?.trim() || null
              : null,
            parceriaReferencia: isPartnership
              ? input.parceriaReferencia?.trim() || null
              : null,
            idCorretor,
            idProprietario: primaryOwner?.id ?? null,
            createdByUserId: ctx.user.id,
          },
          { ownerIds: owners.map(owner => owner.id) }
        );
      }),
    uploadPhoto: staffProcedure
      .input(propertyPhotoUploadSchema)
      .mutation(async ({ input }) => {
        const { optimizeAndStorePropertyImage } = await import(
          "./_core/property-images"
        );

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
        const { removeStoredPropertyImageByUrl } = await import(
          "./_core/property-images"
        );
        await removeStoredPropertyImageByUrl(input.url);
        return { success: true } as const;
      }),
    update: staffProcedure
      .input(updatePropertySchema)
      .mutation(async ({ ctx, input }) => {
        const { findActivePropertyByCepAndNumber, updateProperty } =
          await import("./db");
        const {
          id,
          owner: ownerInput,
          owners: ownerInputs,
          confirmedOwnerEmailConflict,
          ...data
        } = input;
        const property = await ensurePropertyExists(id);

        if (
          ctx.user.role === "corretor" &&
          property.idCorretor !== ctx.user.id &&
          property.createdByUserId !== ctx.user.id
        ) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Você não tem permissão para editar este imóvel",
          });
        }

        const idCorretor =
          ctx.user.role === "corretor" ? ctx.user.id : data.idCorretor;

        if (!idCorretor) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Selecione o responsavel pelo imovel antes de salvar.",
          });
        }

        await ensurePropertyResponsibleUser(idCorretor);
        const isPartnership = data.parceria === true;
        const owners = isPartnership
          ? []
          : await upsertPropertyOwnersFromInput(
              ownerInputs?.length ? ownerInputs : [ownerInput!],
              {
                currentOwnerIds: property.idProprietario
                  ? [property.idProprietario]
                  : [],
                confirmedEmailConflict: confirmedOwnerEmailConflict,
              }
            );
        const primaryOwner = owners[0] ?? null;
        const emCondominio =
          data.emCondominio !== undefined
            ? data.emCondominio
            : property.emCondominio === 1;
        let idCondominio: number | null = emCondominio
          ? data.idCondominio !== undefined
            ? data.idCondominio
            : (property.idCondominio ?? null)
          : null;
        let tipoCondominio: z.infer<typeof condominiumTypeSchema> | null =
          emCondominio
            ? data.tipoCondominio !== undefined
              ? data.tipoCondominio
              : (property.tipoCondominio ?? null)
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
              message:
                "O tipo selecionado nao corresponde ao tipo cadastrado no condominio.",
            });
          }
        } else {
          idCondominio = null;
          tipoCondominio = null;
        }

        const duplicateProperty = await findActivePropertyByCepAndNumber(
          data.cep,
          data.numero,
          {
            excludeId: property.id,
          }
        );
        if (duplicateProperty) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Ja existe um imovel ativo cadastrado neste CEP e numero: ${duplicateProperty.titulo}.`,
          });
        }

        return await updateProperty(
          id,
          {
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
            parceria: isPartnership ? 1 : 0,
            parceriaNome: isPartnership
              ? data.parceriaNome?.trim() || null
              : null,
            parceriaTelefone: isPartnership
              ? data.parceriaTelefone?.trim() || null
              : null,
            parceriaReferencia: isPartnership
              ? data.parceriaReferencia?.trim() || null
              : null,
            idCorretor,
            idProprietario: primaryOwner?.id ?? null,
          },
          { ownerIds: owners.map(owner => owner.id) }
        );
      }),
    delete: adminProcedure
      .input(deletePropertySchema)
      .mutation(async ({ ctx, input }) => {
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
        const { getPropertyById, updatePropertyLegalDetails } = await import(
          "./db"
        );
        const property = await getPropertyById(input.id, {
          includeDeleted: true,
        });
        if (!property) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Imovel nao encontrado",
          });
        }

        return await updatePropertyLegalDetails(input.id, {
          inscricaoImobiliaria:
            normalizeOptionalText(input.inscricaoImobiliaria) ?? null,
          matriculaRegistro:
            normalizeOptionalText(input.matriculaRegistro) ?? null,
          cartorioRegistro:
            normalizeOptionalText(input.cartorioRegistro) ?? null,
          registroMunicipal:
            normalizeOptionalText(input.registroMunicipal) ?? null,
          informacoesLegais:
            normalizeOptionalText(input.informacoesLegais) ?? null,
          observacoesJuridicas:
            normalizeOptionalText(input.observacoesJuridicas) ?? null,
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
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Apenas documentos PDF sao permitidos",
          });
        }

        if (!input.urlArquivo.startsWith("data:application/pdf")) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Arquivo PDF invalido",
          });
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
        const { deletePropertyDocument, getPropertyDocumentById } =
          await import("./db");
        const document = await getPropertyDocumentById(input.id);

        if (!document) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Documento nao encontrado",
          });
        }

        await ensurePropertyManagementAccess(ctx.user, document.idImovel);
        await deletePropertyDocument(input.id);

        return { success: true } as const;
      }),
    renameDocument: staffProcedure
      .input(renamePropertyDocumentSchema)
      .mutation(async ({ ctx, input }) => {
        const { getPropertyDocumentById, updatePropertyDocumentName } =
          await import("./db");
        const document = await getPropertyDocumentById(input.id);

        if (!document) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Documento nao encontrado",
          });
        }

        await ensurePropertyManagementAccess(ctx.user, document.idImovel);

        const normalizedFileName = normalizePropertyDocumentFileName(
          input.nomeArquivo
        );
        return await updatePropertyDocumentName(input.id, normalizedFileName);
      }),
    keyStatusRequests: staffProcedure
      .input(propertyKeyStatusRequestsListSchema)
      .query(async ({ ctx, input }) => {
        const { getPropertyKeyStatusRequestsByPropertyId } = await import(
          "./db"
        );
        await ensurePropertyManagementAccess(ctx.user, input.idImovel);
        return await getPropertyKeyStatusRequestsByPropertyId(input.idImovel);
      }),
    requestKeyStatusChange: staffProcedure
      .input(requestPropertyKeyStatusChangeSchema)
      .mutation(async ({ ctx, input }) => {
        const { createPropertyKeyStatusRequest, updatePropertyKeyStatus } =
          await import("./db");
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

          const updatedProperty = await updatePropertyKeyStatus(
            input.idImovel,
            {
              keyStatus: input.requestedStatus,
              keyStatusObservation: requestedObservation,
              keyStatusUpdatedByUserId: ctx.user.id,
              keyStatusUpdatedAt: new Date(),
            }
          );

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
        const {
          getPropertyKeyStatusRequestById,
          updatePropertyKeyStatus,
          updatePropertyKeyStatusRequest,
        } = await import("./db");

        const request = await getPropertyKeyStatusRequestById(input.requestId);
        if (!request) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Solicitacao de chave nao encontrada",
          });
        }

        if (request.status !== "pending") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Essa solicitacao ja foi analisada anteriormente",
          });
        }

        const reviewNote = normalizeOptionalText(input.reviewNote) ?? null;
        const nextStatus =
          input.decision === "approved" ? "approved" : "rejected";

        const reviewedRequest = await updatePropertyKeyStatusRequest(
          request.id,
          {
            status: nextStatus,
            reviewedByUserId: ctx.user.id,
            reviewedAt: new Date(),
            reviewNote,
          }
        );

        if (nextStatus === "rejected") {
          return {
            request: reviewedRequest,
            property: null,
          };
        }

        await ensurePropertyExists(request.idImovel);
        const updatedProperty = await updatePropertyKeyStatus(
          request.idImovel,
          {
            keyStatus: request.requestedStatus,
            keyStatusObservation: request.requestedObservation,
            keyStatusUpdatedByUserId: ctx.user.id,
            keyStatusUpdatedAt: new Date(),
          }
        );

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
      const {
        createLead,
        createLeadInteraction,
        getUserByCpf,
        getUserById,
        updateUser,
      } = await import("./db");
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

      if (
        ctx.user &&
        (ctx.user.role === "corretor" || ctx.user.role === "administrativo")
      ) {
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
          payload.birthDate =
            payload.birthDate || currentUser.birthDate || null;
          payload.nome =
            payload.nome || currentUser.name || currentUser.email || "Cliente";
          payload.email = payload.email || currentUser.email || null;
          payload.telefone = payload.telefone || currentUser.phone || null;
        }
      } else if (normalizedCpf) {
        const matchedUser = await getUserByCpf(normalizedCpf);
        if (matchedUser) {
          payload.userId = matchedUser.id;
          payload.birthDate =
            payload.birthDate || matchedUser.birthDate || null;

          if (payload.birthDate && !matchedUser.birthDate) {
            await updateUser(matchedUser.id, { birthDate: payload.birthDate });
          }
        }
      }

      if (!payload.nome) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nome do lead e obrigatorio",
        });
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

          if (payload.idResponsavel !== ctx.user?.id) {
            await notifyBrokerLeadAssigned(
              payload.idResponsavel,
              payload.nome,
              createdLeadId
            );
          }
        }
      }

      return createdLead;
    }),
    update: staffProcedure.input(z.any()).mutation(async ({ ctx, input }) => {
      const { createLeadInteraction, getUserByCpf, updateLead } = await import(
        "./db"
      );
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

      const nextStatusRaw =
        "status" in data
          ? normalizeOptionalText(data.status)
          : currentLead.status;
      const nextStatus = nextStatusRaw || currentLead.status;
      const nextResponsibleId =
        "idResponsavel" in data
          ? data.idResponsavel === null
            ? null
            : Number(data.idResponsavel)
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

      if (nextResponsibleId && nextResponsibleId !== currentLead.idResponsavel) {
        await createLeadInteraction({
          idLead: id,
          idUsuario: ctx.user.id,
          eventType: "lead_assigned",
          message: `Lead direcionado ao responsável ID ${nextResponsibleId}.`,
        });

        if (nextResponsibleId !== ctx.user.id) {
          await notifyBrokerLeadAssigned(nextResponsibleId, currentLead.nome, id);
        }
      }

      return await ensureLeadAccess(ctx.user, id);
    }),
    assign: adminProcedure
      .input(assignLeadSchema)
      .mutation(async ({ ctx, input }) => {
        const { createLeadInteraction, getUserById, updateLead } = await import(
          "./db"
        );
        const lead = await ensureLeadAccess(
          { id: 0, role: "administrativo" },
          input.leadId
        );

        if (input.userId !== null) {
          const assignedUser = await getUserById(input.userId);
          if (
            !assignedUser ||
            assignedUser.role !== "corretor" ||
            assignedUser.isActive !== 1
          ) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Selecione um corretor ativo",
            });
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
            message:
              "Lead desvinculado do responsável e aguardando novo direcionamento.",
          });

          return await ensureLeadAccess(
            { id: 0, role: "administrativo" },
            input.leadId
          );
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

        if (input.userId !== ctx.user.id) {
          await notifyBrokerLeadAssigned(input.userId, lead.nome, input.leadId);
        }

        return await ensureLeadAccess(
          { id: 0, role: "administrativo" },
          input.leadId
        );
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
      const createdNote = await createLeadNote({
        ...(input as any),
        idUsuario: ctx.user.id,
      });
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
      const createdFile = await createLeadFile({
        ...(input as any),
        idUsuario: ctx.user.id,
      });
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
        isAssignedToCurrentUser: taskItem.assignees.some(
          assignee => assignee.id === ctx.user.id
        ),
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
        const { getTaskItemTemplateById, updateTaskItemTemplate } =
          await import("./db");
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
    deleteTemplate: adminProcedure
      .input(idSchema)
      .mutation(async ({ input }) => {
        const { deleteTaskItemTemplate, getTaskItemTemplateById } =
          await import("./db");
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
    create: staffProcedure
      .input(createTaskItemSchema)
      .mutation(async ({ ctx, input }) => {
        const {
          createTaskItem,
          getTaskItemWithRelationsById,
          replaceTaskItemAssignees,
        } = await import("./db");
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

        for (const assignee of fullTaskItem.assignees) {
          if (assignee.id !== ctx.user.id) {
            await notifyUserTaskAssigned(
              assignee.id,
              fullTaskItem.kind,
              fullTaskItem.title,
              fullTaskItem.id,
              fullTaskItem.dueAt
            );
          }
        }

        return {
          ...fullTaskItem,
          computedStatus: getComputedTaskStatus(fullTaskItem),
          isAssignedToCurrentUser: fullTaskItem.assignees.some(
            assignee => assignee.id === ctx.user.id
          ),
        };
      }),
    update: staffProcedure
      .input(updateTaskItemSchema)
      .mutation(async ({ ctx, input }) => {
        const {
          getTaskItemWithRelationsById,
          replaceTaskItemAssignees,
          updateTaskItem,
        } = await import("./db");
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

        const previousAssigneeIds = new Set(
          currentTask.assignees.map(assignee => assignee.id)
        );
        for (const assignee of updatedTaskItem.assignees) {
          if (
            assignee.id !== ctx.user.id &&
            !previousAssigneeIds.has(assignee.id)
          ) {
            await notifyUserTaskAssigned(
              assignee.id,
              updatedTaskItem.kind,
              updatedTaskItem.title,
              updatedTaskItem.id,
              updatedTaskItem.dueAt
            );
          }
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
    addNote: staffProcedure
      .input(taskNoteSchema)
      .mutation(async ({ ctx, input }) => {
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

  propertyOwners: router({
    list: adminProcedure.query(async () => {
      const { getAllPropertyOwners } = await import("./db");
      return await getAllPropertyOwners();
    }),
    createQuick: adminProcedure
      .input(quickPropertyOwnerSchema)
      .mutation(async ({ input }) => {
        const {
          createPropertyOwner,
          getPropertyOwnerByCpf,
          getUserByCpf,
          updatePropertyOwner,
        } = await import("./db");

        const matchedUser = await getUserByCpf(input.cpf);
        const existingOwner = await getPropertyOwnerByCpf(input.cpf);

        if (existingOwner) {
          return await updatePropertyOwner(existingOwner.id, {
            name: input.name.trim(),
            email: input.email.trim().toLowerCase(),
            userId: matchedUser?.id ?? existingOwner.userId ?? null,
          });
        }

        return await createPropertyOwner({
          name: input.name.trim(),
          email: input.email.trim().toLowerCase(),
          cpf: input.cpf,
          phone: "",
          userId: matchedUser?.id ?? null,
        });
      }),
  }),

  contractTemplates: router({
    list: adminProcedure.input(listContractTemplatesSchema).query(async ({ input }) => {
      const { getContractTemplates } = await import("./db");
      return await getContractTemplates(input?.contractKind);
    }),
    extractDocxText: adminProcedure
      .input(contractTemplateDocxSchema)
      .mutation(async ({ input }) => {
        const extractedText = await extractDocxTextFromDataUrl(input.dataUrl);
        return {
          fileName: input.fileName,
          mimeType: input.mimeType,
          extractedText,
          detectedVariables: detectContractTemplateVariables(extractedText),
        };
      }),
    create: adminProcedure
      .input(createContractTemplateSchema)
      .mutation(async ({ ctx, input }) => {
        const { createContractTemplate } = await import("./db");
        return await createContractTemplate({
          name: input.name,
          notes: input.notes?.trim() || null,
          contractKind: input.contractKind,
          participantRoles: JSON.stringify(input.participantRoles),
          originalFileName: input.originalFileName,
          originalMimeType: input.originalMimeType,
          originalFileData: input.originalFileData,
          extractedText: input.extractedText,
          reviewedText: input.reviewedText,
          variableHighlights: JSON.stringify(input.variableHighlights),
          createdByUserId: ctx.user.id,
        });
      }),
    update: adminProcedure
      .input(updateContractTemplateSchema)
      .mutation(async ({ input }) => {
        const { updateContractTemplate } = await import("./db");
        return await updateContractTemplate(input.id, {
          name: input.name,
          notes: input.notes?.trim() || null,
          contractKind: input.contractKind,
          participantRoles: input.participantRoles
            ? JSON.stringify(input.participantRoles)
            : undefined,
          reviewedText: input.reviewedText,
          variableHighlights: JSON.stringify(input.variableHighlights),
        });
      }),
    delete: adminProcedure.input(idSchema).mutation(async ({ input }) => {
      const { deleteContractTemplate } = await import("./db");
      await deleteContractTemplate(input.id);
      return { success: true } as const;
    }),
  }),

  rentalProposals: router({
    list: adminProcedure.query(async () => {
      const { getRentalProposals } = await import("./db");
      return await getRentalProposals();
    }),
    getById: adminProcedure.input(idSchema).query(async ({ input }) => {
      const { getRentalProposalById } = await import("./db");
      const proposal = await getRentalProposalById(input.id);
      if (!proposal) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Proposta de locacao nao encontrada.",
        });
      }
      return proposal;
    }),
    pendingForProperty: adminProcedure
      .input(z.object({ propertyId: z.number().int().positive() }))
      .query(async ({ input }) => {
        const { getPendingRentalProposalByProperty } = await import("./db");
        const pending = await getPendingRentalProposalByProperty(
          input.propertyId
        );
        return pending ?? null;
      }),
    create: adminProcedure
      .input(createRentalProposalSchema)
      .mutation(async ({ ctx, input }) => {
        const {
          createRentalProposal,
          getPropertyByIdWithRelations,
          getPropertyOwnerById,
          getUserById,
        } = await import("./db");
        const property = await getPropertyByIdWithRelations(input.propertyId);
        if (!property) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Imovel nao encontrado.",
          });
        }

        const broker = await getUserById(input.brokerUserId);
        if (
          !broker ||
          (broker.role !== "corretor" && broker.role !== "administrativo")
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Selecione um corretor responsavel valido.",
          });
        }

        const tenantUserIds = uniquePositiveIds(
          input.tenantUserIds?.length
            ? input.tenantUserIds
            : [input.tenantUserId]
        );
        if (tenantUserIds.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Selecione ao menos um locatario.",
          });
        }

        const tenants = await Promise.all(
          tenantUserIds.map(id => getUserById(id))
        );
        if (tenants.some(tenant => !tenant || tenant.role !== "cliente")) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Selecione locatarios validos.",
          });
        }

        const propertyOwnerIds = property.proprietarios?.length
          ? property.proprietarios.map((owner: { id: number }) => owner.id)
          : property.idProprietario
            ? [property.idProprietario]
            : [];
        const ownerIds = uniquePositiveIds(
          input.ownerIds?.length ? input.ownerIds : propertyOwnerIds
        );
        if (ownerIds.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Selecione ao menos um proprietario.",
          });
        }

        const owners = await Promise.all(
          ownerIds.map(id => getPropertyOwnerById(id))
        );
        if (owners.some(owner => !owner)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Selecione proprietarios validos.",
          });
        }

        if (!input.ownerConfirmed) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Confirme os dados basicos dos proprietarios.",
          });
        }

        if (!input.tenantConfirmed) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Confirme os dados basicos dos locatarios.",
          });
        }

        const contextSnapshot = {
          property,
          owner: owners[0] ?? property.proprietario ?? null,
          owners,
          broker: toSafeUser(broker),
          tenant: toSafeUser(tenants[0]!),
          tenants: tenants.map(tenant => toSafeUser(tenant!)),
          lease: {
            leaseTermMonths: input.leaseTermMonths,
            adjustmentIndex: input.adjustmentIndex,
            adjustmentPeriod: input.adjustmentPeriod,
            administrationFeePercent: input.administrationFeePercent,
            transferBusinessDays: input.transferBusinessDays,
            terminationPenaltyType: input.terminationPenaltyType,
            terminationPenaltyAmount: input.terminationPenaltyAmount,
            rentAmount: input.rentAmount,
            condominiumAmount: input.condominiumAmount ?? null,
            startDate: input.startDate,
            dueDay: input.dueDay,
            notes: input.notes?.trim() || null,
          },
        };

        return await createRentalProposal(
          {
            status: "rascunho",
            currentStep: "modelos_contrato",
            propertyId: input.propertyId,
            ownerId: ownerIds[0] ?? null,
            brokerUserId: input.brokerUserId,
            tenantUserId: tenantUserIds[0],
            ownerConfirmedAt: new Date(),
            tenantConfirmedAt: new Date(),
            leaseTermMonths: input.leaseTermMonths,
            adjustmentIndex: input.adjustmentIndex,
            adjustmentPeriod: input.adjustmentPeriod,
            administrationFeePercent: input.administrationFeePercent,
            transferBusinessDays: input.transferBusinessDays,
            terminationPenaltyType: input.terminationPenaltyType,
            terminationPenaltyAmount: input.terminationPenaltyAmount,
            rentAmount: input.rentAmount,
            condominiumAmount: input.condominiumAmount ?? null,
            startDate: new Date(`${input.startDate}T00:00:00`),
            dueDay: input.dueDay,
            contextSnapshot: JSON.stringify(contextSnapshot),
            notes: input.notes?.trim() || null,
            createdByUserId: ctx.user.id,
          },
          { tenantUserIds, ownerIds }
        );
      }),
    update: adminProcedure
      .input(updateRentalProposalSchema)
      .mutation(async ({ input }) => {
        const {
          getRentalProposalById,
          getPropertyByIdWithRelations,
          getPropertyOwnerById,
          getUserById,
          updateRentalProposal,
        } = await import("./db");

        const currentProposal = await getRentalProposalById(input.id);
        if (!currentProposal) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Proposta de locacao nao encontrada.",
          });
        }

        const property = await getPropertyByIdWithRelations(input.propertyId);
        if (!property) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Imovel nao encontrado.",
          });
        }

        const broker = await getUserById(input.brokerUserId);
        if (
          !broker ||
          (broker.role !== "corretor" && broker.role !== "administrativo")
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Selecione um corretor responsavel valido.",
          });
        }

        const tenantUserIds = uniquePositiveIds(
          input.tenantUserIds?.length
            ? input.tenantUserIds
            : [input.tenantUserId]
        );
        if (tenantUserIds.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Selecione ao menos um locatario.",
          });
        }

        const tenants = await Promise.all(
          tenantUserIds.map(id => getUserById(id))
        );
        if (tenants.some(tenant => !tenant || tenant.role !== "cliente")) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Selecione locatarios validos.",
          });
        }

        const propertyOwnerIds = property.proprietarios?.length
          ? property.proprietarios.map((owner: { id: number }) => owner.id)
          : property.idProprietario
            ? [property.idProprietario]
            : [];
        const ownerIds = uniquePositiveIds(
          input.ownerIds?.length ? input.ownerIds : propertyOwnerIds
        );
        if (ownerIds.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Selecione ao menos um proprietario.",
          });
        }

        const owners = await Promise.all(
          ownerIds.map(id => getPropertyOwnerById(id))
        );
        if (owners.some(owner => !owner)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Selecione proprietarios validos.",
          });
        }

        if (!input.ownerConfirmed) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Confirme os dados basicos dos proprietarios.",
          });
        }

        if (!input.tenantConfirmed) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Confirme os dados basicos dos locatarios.",
          });
        }

        const contextSnapshot = {
          property,
          owner: owners[0] ?? property.proprietario ?? null,
          owners,
          broker: toSafeUser(broker),
          tenant: toSafeUser(tenants[0]!),
          tenants: tenants.map(tenant => toSafeUser(tenant!)),
          lease: {
            leaseTermMonths: input.leaseTermMonths,
            adjustmentIndex: input.adjustmentIndex,
            adjustmentPeriod: input.adjustmentPeriod,
            administrationFeePercent: input.administrationFeePercent,
            transferBusinessDays: input.transferBusinessDays,
            terminationPenaltyType: input.terminationPenaltyType,
            terminationPenaltyAmount: input.terminationPenaltyAmount,
            rentAmount: input.rentAmount,
            condominiumAmount: input.condominiumAmount ?? null,
            startDate: input.startDate,
            dueDay: input.dueDay,
            notes: input.notes?.trim() || null,
          },
        };

        return await updateRentalProposal(
          input.id,
          {
            propertyId: input.propertyId,
            ownerId: ownerIds[0] ?? null,
            brokerUserId: input.brokerUserId,
            tenantUserId: tenantUserIds[0],
            ownerConfirmedAt: new Date(),
            tenantConfirmedAt: new Date(),
            leaseTermMonths: input.leaseTermMonths,
            adjustmentIndex: input.adjustmentIndex,
            adjustmentPeriod: input.adjustmentPeriod,
            administrationFeePercent: input.administrationFeePercent,
            transferBusinessDays: input.transferBusinessDays,
            terminationPenaltyType: input.terminationPenaltyType,
            terminationPenaltyAmount: input.terminationPenaltyAmount,
            rentAmount: input.rentAmount,
            condominiumAmount: input.condominiumAmount ?? null,
            startDate: new Date(`${input.startDate}T00:00:00`),
            dueDay: input.dueDay,
            contextSnapshot: JSON.stringify(contextSnapshot),
            notes: input.notes?.trim() || null,
          },
          { tenantUserIds, ownerIds }
        );
      }),
    updateContractTemplatesInReview: adminProcedure
      .input(selectRentalProposalContractTemplatesSchema)
      .mutation(async ({ input }) => {
        const {
          getContractTemplates,
          getRentalProposalById,
          getRentalProposalGeneratedContracts,
          updateRentalProposalContractTemplates,
          addRentalProposalGeneratedContracts,
          deleteRentalProposalGeneratedContractsByTemplates,
        } = await import("./db");

        const proposal = await getRentalProposalById(input.id);
        if (!proposal) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Proposta de locacao nao encontrada.",
          });
        }

        if (
          proposal.currentStep !== "modelos_contrato" &&
          proposal.currentStep !== "contratos_em_revisao" &&
          proposal.currentStep !== "boletos_pendentes"
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "A edicao dos modelos nao esta disponivel nesta etapa da proposta.",
          });
        }

        const contractTemplateIds = uniquePositiveIds(input.contractTemplateIds);
        if (contractTemplateIds.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Selecione ao menos um modelo de contrato.",
          });
        }

        const templates = await getContractTemplates("locacao");
        const templatesById = new Map(
          templates.map(template => [template.id, template])
        );
        const invalidTemplateIds = contractTemplateIds.filter(
          id => !templatesById.has(id)
        );
        if (invalidTemplateIds.length > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Selecione modelos de contrato validos.",
          });
        }

        const existingContracts = await getRentalProposalGeneratedContracts(
          proposal.id
        );
        const existingTemplateIds = new Set(
          existingContracts.map(contract => contract.contractTemplateId)
        );
        const selectedSet = new Set(contractTemplateIds);
        const toAdd = contractTemplateIds.filter(
          id => !existingTemplateIds.has(id)
        );
        const toRemove = Array.from(existingTemplateIds).filter(
          id => !selectedSet.has(id)
        );

        await updateRentalProposalContractTemplates(
          proposal.id,
          contractTemplateIds
        );

        if (toRemove.length > 0) {
          await deleteRentalProposalGeneratedContractsByTemplates(
            proposal.id,
            toRemove
          );
        }

        if (toAdd.length > 0) {
          const contextSnapshot = parseRecord(proposal.contextSnapshot);
          const variableSource =
            buildRentalProposalVariableSource(contextSnapshot);
          const newContracts = toAdd.map(id => {
            const template = templatesById.get(id)!;
            const variables = parseContractTemplateVariables(
              template.variableHighlights
            );
            const { generatedText, variableValues, unresolvedVariables } =
              applyRentalProposalVariables(
                template.reviewedText || template.extractedText,
                variables,
                variableSource
              );

            return {
              rentalProposalId: proposal.id,
              contractTemplateId: template.id,
              status: "em_revisao" as const,
              title: template.name,
              generatedText,
              reviewedText: generatedText,
              variableValues: JSON.stringify(variableValues),
              unresolvedVariables: JSON.stringify(unresolvedVariables),
            };
          });
          await addRentalProposalGeneratedContracts(newContracts);
        }

        // Reconcilia a etapa: adicionar reabre a revisao; remover deixando
        // tudo aprovado finaliza e gera/mantem o codigo de referencia.
        const reconciled = await reconcileRentalProposalContractStage(
          proposal.id
        );

        return {
          success: true,
          added: toAdd.length,
          removed: toRemove.length,
          referenceCode: reconciled.referenceCode,
          allApproved: reconciled.allApproved,
        } as const;
      }),
    updateGeneratedContractText: adminProcedure
      .input(updateRentalProposalGeneratedContractTextSchema)
      .mutation(async ({ input }) => {
        const {
          getRentalProposalById,
          getRentalProposalGeneratedContractById,
          updateRentalProposalGeneratedContractText,
        } = await import("./db");
        const contract = await getRentalProposalGeneratedContractById(
          input.contractId
        );
        if (!contract) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Contrato gerado nao encontrado.",
          });
        }

        const proposal = await getRentalProposalById(contract.rentalProposalId);
        if (!proposal) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Proposta de locacao nao encontrada.",
          });
        }

        if (
          proposal.currentStep !== "contratos_em_revisao" &&
          proposal.currentStep !== "boletos_pendentes"
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "A edicao manual nao esta disponivel nesta etapa da proposta.",
          });
        }

        const updated = await updateRentalProposalGeneratedContractText(
          input.contractId,
          input.reviewedText
        );
        // Editar reabre a revisao quando a proposta ja havia avancado.
        await reconcileRentalProposalContractStage(contract.rentalProposalId);
        return { success: true, contract: updated } as const;
      }),
    approveGeneratedContract: adminProcedure
      .input(approveRentalProposalGeneratedContractSchema)
      .mutation(async ({ ctx, input }) => {
        const {
          approveRentalProposalGeneratedContract,
          getRentalProposalById,
          getRentalProposalGeneratedContractById,
        } = await import("./db");
        const contract = await getRentalProposalGeneratedContractById(
          input.contractId
        );
        if (!contract) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Contrato gerado nao encontrado.",
          });
        }

        const proposal = await getRentalProposalById(contract.rentalProposalId);
        if (!proposal) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Proposta de locacao nao encontrada.",
          });
        }

        if (proposal.currentStep !== "contratos_em_revisao") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "A aprovacao esta disponivel apenas na etapa Contratos em revisao.",
          });
        }

        if (!contract.reviewedText.trim()) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Revise o texto do contrato antes de aprovar.",
          });
        }

        const updated = await approveRentalProposalGeneratedContract(
          input.contractId,
          ctx.user.id
        );
        const reconciled = await reconcileRentalProposalContractStage(
          contract.rentalProposalId
        );

        return {
          success: true,
          contract: updated,
          allApproved: reconciled.allApproved,
          referenceCode: reconciled.referenceCode,
        } as const;
      }),
    generatedContractDocx: adminProcedure
      .input(z.object({ contractId: z.number().int().positive() }))
      .query(async ({ input }) => {
        const {
          getRentalProposalById,
          getRentalProposalGeneratedContractById,
          getContractTemplateById,
        } = await import("./db");
        const { renderContractDocx, ContractDocxFillError } = await import(
          "./contract-docx"
        );
        const { buildContractReferenceFooter } = await import(
          "@shared/contract-reference"
        );

        const contract = await getRentalProposalGeneratedContractById(
          input.contractId
        );
        if (!contract) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Contrato gerado nao encontrado.",
          });
        }

        if (contract.status !== "aprovado") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "O contrato precisa estar aprovado para baixar o documento.",
          });
        }

        const template = await getContractTemplateById(
          contract.contractTemplateId
        );
        if (!template) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "O modelo .docx deste contrato nao existe mais. Selecione os modelos da proposta novamente.",
          });
        }

        const isDocx =
          template.originalMimeType ===
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
          template.originalFileName.toLowerCase().endsWith(".docx");
        if (!isDocx) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "O modelo deste contrato nao e um arquivo .docx, entao nao e possivel preservar o layout do Word.",
          });
        }

        const proposal = await getRentalProposalById(contract.rentalProposalId);
        const referenceCode = proposal?.referenceCode ?? null;
        const templateBuffer = decodeDocxDataUrl(template.originalFileData);

        let docxBuffer: Buffer;
        try {
          docxBuffer = renderContractDocx({
            templateBuffer,
            bodyText: contract.reviewedText,
            footerText: referenceCode
              ? buildContractReferenceFooter(referenceCode)
              : null,
          });
        } catch (error) {
          if (error instanceof ContractDocxFillError) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: error.message,
            });
          }
          throw error;
        }

        const safeTitle =
          contract.title
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-zA-Z0-9-_]+/g, "_")
            .replace(/^_+|_+$/g, "")
            .slice(0, 80) || "contrato";
        const referenceSuffix = referenceCode ? `-${referenceCode}` : "";

        return {
          fileName: `${safeTitle}${referenceSuffix}.docx`,
          contentType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          dataUrl: `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${docxBuffer.toString("base64")}`,
        } as const;
      }),
    regenerateGeneratedContract: adminProcedure
      .input(regenerateRentalProposalGeneratedContractSchema)
      .mutation(async ({ input }) => {
        const {
          getRentalProposalById,
          getRentalProposalGeneratedContractById,
          getContractTemplateById,
          regenerateRentalProposalGeneratedContract,
        } = await import("./db");
        const contract = await getRentalProposalGeneratedContractById(
          input.contractId
        );
        if (!contract) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Contrato gerado nao encontrado.",
          });
        }

        const proposal = await getRentalProposalById(contract.rentalProposalId);
        if (!proposal) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Proposta de locacao nao encontrada.",
          });
        }

        if (
          proposal.currentStep !== "contratos_em_revisao" &&
          proposal.currentStep !== "boletos_pendentes"
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "A geracao novamente nao esta disponivel nesta etapa da proposta.",
          });
        }

        const template = await getContractTemplateById(
          contract.contractTemplateId
        );
        if (!template) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "O modelo deste contrato nao existe mais. Selecione os modelos da proposta novamente.",
          });
        }

        const contextSnapshot = parseRecord(proposal.contextSnapshot);
        const variableSource =
          buildRentalProposalVariableSource(contextSnapshot);
        const variables = parseContractTemplateVariables(
          template.variableHighlights
        );
        const { generatedText, variableValues, unresolvedVariables } =
          applyRentalProposalVariables(
            template.reviewedText || template.extractedText,
            variables,
            variableSource
          );

        const updated = await regenerateRentalProposalGeneratedContract(
          input.contractId,
          {
            title: template.name,
            generatedText,
            reviewedText: generatedText,
            variableValues: JSON.stringify(variableValues),
            unresolvedVariables: JSON.stringify(unresolvedVariables),
          }
        );

        // Regerar reabre a revisao quando a proposta ja havia avancado.
        await reconcileRentalProposalContractStage(contract.rentalProposalId);
        return { success: true, contract: updated } as const;
      }),
    deleteGeneratedContract: adminProcedure
      .input(z.object({ contractId: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        const {
          getRentalProposalById,
          getRentalProposalGeneratedContractById,
          getRentalProposalContractTemplates,
          updateRentalProposalContractTemplates,
          deleteRentalProposalGeneratedContractById,
        } = await import("./db");

        const contract = await getRentalProposalGeneratedContractById(
          input.contractId
        );
        if (!contract) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Contrato gerado nao encontrado.",
          });
        }

        const proposal = await getRentalProposalById(contract.rentalProposalId);
        if (!proposal) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Proposta de locacao nao encontrada.",
          });
        }

        if (
          proposal.currentStep !== "contratos_em_revisao" &&
          proposal.currentStep !== "boletos_pendentes"
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "A exclusao de contratos nao esta disponivel nesta etapa da proposta.",
          });
        }

        await deleteRentalProposalGeneratedContractById(contract.id);

        const currentTemplates = await getRentalProposalContractTemplates(
          proposal.id
        );
        const remainingTemplateIds = currentTemplates
          .map(template => template.id)
          .filter(id => id !== contract.contractTemplateId);
        await updateRentalProposalContractTemplates(
          proposal.id,
          remainingTemplateIds
        );

        const reconciled = await reconcileRentalProposalContractStage(
          proposal.id
        );

        return {
          success: true,
          referenceCode: reconciled.referenceCode,
        } as const;
      }),
    generateBoletos: adminProcedure
      .input(idSchema)
      .mutation(async ({ input }) => {
        const {
          getRentalProposalById,
          getRentalProposalBoletos,
          insertRentalProposalBoletos,
          updateRentalProposal,
        } = await import("./db");

        const proposal = await getRentalProposalById(input.id);
        if (!proposal) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Proposta de locacao nao encontrada.",
          });
        }

        if (proposal.currentStep !== "boletos_pendentes") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "A geracao de boletos so esta disponivel apos a aprovacao dos contratos.",
          });
        }

        if (!proposal.referenceCode) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Aprove todos os contratos para gerar o codigo de referencia antes dos boletos.",
          });
        }

        const existing = await getRentalProposalBoletos(proposal.id);
        if (existing.length > 0) {
          return { success: true, created: 0, boletos: existing } as const;
        }

        const schedule = buildRentalBoletoSchedule({
          startDate: proposal.startDate,
          dueDay: proposal.dueDay,
          leaseTermMonths: proposal.leaseTermMonths,
          rentAmount: proposal.rentAmount,
          condominiumAmount: proposal.condominiumAmount,
        });

        if (schedule.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Nao foi possivel montar o cronograma: verifique o tempo de vigencia da proposta.",
          });
        }

        const created = await insertRentalProposalBoletos(
          schedule.map(item => ({
            rentalProposalId: proposal.id,
            installmentNumber: item.installmentNumber,
            referenceMonth: new Date(`${item.referenceMonth}T00:00:00.000Z`),
            dueDate: new Date(`${item.dueDate}T00:00:00.000Z`),
            rentAmount: item.rentAmount,
            condominiumAmount: item.condominiumAmount,
            extraAmount: item.extraAmount,
            totalAmount: item.totalAmount,
            status: "pendente" as const,
          }))
        );

        // Gerar os boletos avanca o processo da proposta para a etapa de
        // seguros. A validacao/aprovacao de cada boleto passa a ser um controle
        // administrativo paralelo, feito na sub-pagina de Boletos.
        await updateRentalProposal(proposal.id, {
          status: "seguros_pendentes",
          currentStep: "seguros_pendentes",
        });

        return {
          success: true,
          created: created.length,
          boletos: created,
        } as const;
      }),
    regenerateBoletos: adminProcedure
      .input(idSchema)
      .mutation(async ({ input }) => {
        const {
          getRentalProposalById,
          getRentalProposalBoletos,
          replaceRentalProposalBoletos,
        } = await import("./db");

        const proposal = await getRentalProposalById(input.id);
        if (!proposal) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Proposta de locacao nao encontrada.",
          });
        }

        if (!proposal.referenceCode) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Gere os boletos a partir de uma proposta com contratos aprovados.",
          });
        }

        const existing = await getRentalProposalBoletos(proposal.id);
        if (existing.some(boleto => boleto.status === "aprovado")) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Ha boletos ja aprovados. Edite-os individualmente em vez de regerar todo o cronograma.",
          });
        }

        const schedule = buildRentalBoletoSchedule({
          startDate: proposal.startDate,
          dueDay: proposal.dueDay,
          leaseTermMonths: proposal.leaseTermMonths,
          rentAmount: proposal.rentAmount,
          condominiumAmount: proposal.condominiumAmount,
        });

        const created = await replaceRentalProposalBoletos(
          proposal.id,
          schedule.map(item => ({
            rentalProposalId: proposal.id,
            installmentNumber: item.installmentNumber,
            referenceMonth: new Date(`${item.referenceMonth}T00:00:00.000Z`),
            dueDate: new Date(`${item.dueDate}T00:00:00.000Z`),
            rentAmount: item.rentAmount,
            condominiumAmount: item.condominiumAmount,
            extraAmount: item.extraAmount,
            totalAmount: item.totalAmount,
            status: "pendente" as const,
          }))
        );

        return {
          success: true,
          created: created.length,
          boletos: created,
        } as const;
      }),
    updateBoleto: adminProcedure
      .input(updateRentalProposalBoletoSchema)
      .mutation(async ({ input }) => {
        const {
          getRentalProposalById,
          getRentalProposalBoletoById,
          updateRentalProposalBoleto,
        } = await import("./db");

        const boleto = await getRentalProposalBoletoById(input.boletoId);
        if (!boleto) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Boleto nao encontrado.",
          });
        }

        const proposal = await getRentalProposalById(boleto.rentalProposalId);
        if (!proposal) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Proposta de locacao nao encontrada.",
          });
        }

        if (!proposal.referenceCode) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "A edicao de boletos nao esta disponivel nesta etapa.",
          });
        }

        const rentAmount = input.rentAmount ?? boleto.rentAmount;
        const condominiumAmount =
          input.condominiumAmount !== undefined
            ? input.condominiumAmount
            : boleto.condominiumAmount;
        const extraAmount = input.extraAmount ?? boleto.extraAmount;
        const totalAmount = calculateBoletoTotal({
          rentAmount,
          condominiumAmount,
          extraAmount,
        });

        // Editar sempre devolve o boleto para revisao (pendente).
        const updated = await updateRentalProposalBoleto(boleto.id, {
          dueDate: input.dueDate
            ? new Date(`${input.dueDate}T00:00:00.000Z`)
            : boleto.dueDate,
          rentAmount,
          condominiumAmount,
          extraAmount,
          extraDescription:
            input.extraDescription !== undefined
              ? input.extraDescription
              : boleto.extraDescription,
          notes: input.notes !== undefined ? input.notes : boleto.notes,
          totalAmount,
          status: "pendente",
          approvedAt: null,
          approvedByUserId: null,
        });

        return {
          success: true,
          boleto: updated,
        } as const;
      }),
    updateBoletosBatch: adminProcedure
      .input(updateRentalProposalBoletosBatchSchema)
      .mutation(async ({ input }) => {
        const {
          getRentalProposalById,
          getRentalProposalBoletos,
          updateRentalProposalBoleto,
        } = await import("./db");

        const proposal = await getRentalProposalById(input.id);
        if (!proposal) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Proposta de locacao nao encontrada.",
          });
        }

        if (!proposal.referenceCode) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "A edicao de boletos nao esta disponivel nesta etapa.",
          });
        }

        const allBoletos = await getRentalProposalBoletos(proposal.id);
        const targetIds = input.boletoIds?.length
          ? new Set(input.boletoIds)
          : null;
        const targets = targetIds
          ? allBoletos.filter(boleto => targetIds.has(boleto.id))
          : allBoletos;

        if (targets.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Nenhum boleto selecionado para a edicao em lote.",
          });
        }

        const { patch } = input;
        for (const boleto of targets) {
          const rentAmount = patch.rentAmount ?? boleto.rentAmount;
          const condominiumAmount =
            patch.condominiumAmount !== undefined
              ? patch.condominiumAmount
              : boleto.condominiumAmount;
          const extraAmount = patch.extraAmount ?? boleto.extraAmount;
          const referenceMonth = boleto.referenceMonth;
          const dueDate =
            patch.dueDay !== undefined
              ? new Date(
                  `${buildBoletoDueDate(
                    referenceMonth.getUTCFullYear(),
                    referenceMonth.getUTCMonth(),
                    patch.dueDay
                  )}T00:00:00.000Z`
                )
              : boleto.dueDate;

          await updateRentalProposalBoleto(boleto.id, {
            dueDate,
            rentAmount,
            condominiumAmount,
            extraAmount,
            extraDescription:
              patch.extraDescription !== undefined
                ? patch.extraDescription
                : boleto.extraDescription,
            totalAmount: calculateBoletoTotal({
              rentAmount,
              condominiumAmount,
              extraAmount,
            }),
            status: "pendente",
            approvedAt: null,
            approvedByUserId: null,
          });
        }

        return {
          success: true,
          updated: targets.length,
        } as const;
      }),
    approveBoleto: adminProcedure
      .input(z.object({ boletoId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const {
          getRentalProposalById,
          getRentalProposalBoletoById,
          approveRentalProposalBoleto,
        } = await import("./db");

        const boleto = await getRentalProposalBoletoById(input.boletoId);
        if (!boleto) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Boleto nao encontrado.",
          });
        }

        const proposal = await getRentalProposalById(boleto.rentalProposalId);
        if (!proposal) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Proposta de locacao nao encontrada.",
          });
        }

        if (!proposal.referenceCode) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "A aprovacao de boletos nao esta disponivel nesta etapa.",
          });
        }

        if (boleto.totalAmount <= 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Revise o valor do boleto antes de aprovar.",
          });
        }

        const updated = await approveRentalProposalBoleto(
          boleto.id,
          ctx.user.id
        );

        return {
          success: true,
          boleto: updated,
        } as const;
      }),
    approveAllBoletos: adminProcedure
      .input(idSchema)
      .mutation(async ({ ctx, input }) => {
        const {
          getRentalProposalById,
          getRentalProposalBoletos,
          approveAllRentalProposalBoletos,
        } = await import("./db");

        const proposal = await getRentalProposalById(input.id);
        if (!proposal) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Proposta de locacao nao encontrada.",
          });
        }

        if (!proposal.referenceCode) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "A aprovacao de boletos nao esta disponivel nesta etapa.",
          });
        }

        const boletos = await getRentalProposalBoletos(proposal.id);
        if (boletos.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Gere os boletos antes de aprova-los.",
          });
        }
        if (boletos.some(boleto => boleto.totalAmount <= 0)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Existe boleto com valor invalido. Revise antes de aprovar todos.",
          });
        }

        await approveAllRentalProposalBoletos(proposal.id, ctx.user.id);

        return { success: true } as const;
      }),
    setBoletoPaid: adminProcedure
      .input(
        z.object({
          boletoId: z.number().int().positive(),
          paid: z.boolean(),
        })
      )
      .mutation(async ({ input }) => {
        const {
          getRentalProposalById,
          getRentalProposalBoletoById,
          markRentalProposalBoletoPaid,
        } = await import("./db");

        const boleto = await getRentalProposalBoletoById(input.boletoId);
        if (!boleto) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Boleto nao encontrado.",
          });
        }

        const proposal = await getRentalProposalById(boleto.rentalProposalId);
        if (!proposal || !proposal.referenceCode) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "A baixa de pagamento nao esta disponivel nesta etapa.",
          });
        }

        const updated = await markRentalProposalBoletoPaid(
          boleto.id,
          input.paid ? new Date() : null
        );

        return { success: true, boleto: updated } as const;
      }),
    boletoSets: adminProcedure.query(async () => {
      const { getRentalProposalBoletoSets } = await import("./db");
      return await getRentalProposalBoletoSets();
    }),
    delete: adminProcedure.input(idSchema).mutation(async ({ input }) => {
      const { deleteRentalProposal, getRentalProposalById } = await import(
        "./db"
      );
      const proposal = await getRentalProposalById(input.id);
      if (!proposal) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Proposta de locacao nao encontrada.",
        });
      }
      await deleteRentalProposal(input.id);
      return { success: true } as const;
    }),
  }),

  documents: router({
    myDocuments: clientProcedure.query(async ({ ctx }) => {
      const { getDocumentsByUsuario } = await import("./db");
      return await getDocumentsByUsuario(ctx.user.id);
    }),
    create: clientProcedure.input(z.any()).mutation(async ({ ctx, input }) => {
      const { createDocument } = await import("./db");
      return await createDocument({
        ...(input as any),
        idUsuario: ctx.user.id,
      });
    }),
    updateStatus: adminProcedure.input(z.any()).mutation(async ({ input }) => {
      const { id, status } = input as any;
      const { updateDocument } = await import("./db");
      return await updateDocument(id, { status });
    }),
  }),

  profile: router({
    update: protectedProcedure
      .input(profileDetailsSchema)
      .mutation(async ({ ctx, input }) => {
        const { getUserById, linkPropertyOwnersToUserByCpf, updateUser } =
          await import("./db");
        const user = await getUserById(ctx.user.id);
        if (!user) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Usuario nao encontrado",
          });
        }
        assertRootAdminMutable(user);
        /*

        throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado" });
      }

      */
        await ensureUniqueUserIdentity(input.email, input.cpf, ctx.user.id);
        const normalizedCreci =
          user.role === "corretor"
            ? normalizeOptionalCreci(input.creci)
            : undefined;

        await updateUser(ctx.user.id, {
          name: input.name.trim(),
          email: input.email,
          cpf: input.cpf,
          phone: input.phone?.trim() || null,
          creci: user.role === "corretor" ? normalizedCreci || null : null,
          creciStatus:
            user.role === "corretor" && normalizedCreci ? "pending" : null,
          creciVerifiedAt: null,
          creciVerifiedByUserId: null,
          birthDate: input.birthDate
            ? new Date(`${input.birthDate}T00:00:00`)
            : null,
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
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Usuário não encontrado",
          });
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
    propertyOwnerById: adminProcedure
      .input(idSchema)
      .query(async ({ input }) => {
        const { getPropertyOwnerById, getUserById } = await import("./db");
        const owner = await getPropertyOwnerById(input.id);

        if (!owner) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Proprietario nao encontrado",
          });
        }

        const linkedUser = owner.userId
          ? await getUserById(owner.userId)
          : null;

        return {
          ...owner,
          linkedUser: linkedUser ? toSafeUser(linkedUser) : null,
        };
      }),
    createPropertyOwnerLogin: adminProcedure
      .input(idSchema)
      .mutation(async ({ ctx, input }) => {
        const {
          createUser,
          getPropertyOwnerById,
          getUserByCpf,
          getUserByEmail,
          updatePropertyOwner,
        } = await import("./db");
        const owner = await getPropertyOwnerById(input.id);

        if (!owner) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Proprietario nao encontrado",
          });
        }

        if (owner.userId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Este proprietario ja possui login cadastrado.",
          });
        }

        if (!owner.email || !owner.cpf) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Preencha e-mail e CPF na ficha do proprietario antes de cadastrar login.",
          });
        }

        const existingByCpf = await getUserByCpf(owner.cpf);
        if (existingByCpf) {
          await updatePropertyOwner(owner.id, { userId: existingByCpf.id });
          return { user: toSafeUser(existingByCpf), temporaryPassword: null };
        }

        const existingByEmail = await getUserByEmail(owner.email);
        if (existingByEmail) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "Ja existe um usuario com este e-mail. Vincule pelo CPF ou ajuste o e-mail do proprietario.",
          });
        }

        const temporaryPassword = nanoid(12);
        const createdUser = await createUser({
          openId: `local:${nanoid()}`,
          name: owner.name,
          email: owner.email,
          cpf: owner.cpf,
          phone: owner.phone || null,
          birthDate: owner.birthDate ?? null,
          profession: owner.profession ?? null,
          grossMonthlyIncome: owner.grossMonthlyIncome ?? null,
          maritalStatus: owner.maritalStatus ?? null,
          householdIncome: owner.householdIncome ?? null,
          rg: owner.rg ?? null,
          nationality: owner.nationality ?? null,
          address: owner.address ?? null,
          neighborhood: owner.neighborhood ?? null,
          addressNumber: owner.addressNumber ?? null,
          city: owner.city ?? null,
          state: owner.state ?? null,
          zipCode: owner.zipCode ?? null,
          notes: owner.notes ?? null,
          loginMethod: "password",
          passwordHash: await hashPassword(temporaryPassword),
          registrationSource: "admin_created",
          role: "cliente",
          isActive: 1,
        });

        await updatePropertyOwner(owner.id, { userId: createdUser.id });

        void sendWelcomeEmail({
          user: createdUser,
          req: ctx.req,
        }).catch(error => {
          console.error(
            "[Email] Falha ao enviar boas-vindas para proprietario",
            error
          );
        });

        return { user: toSafeUser(createdUser), temporaryPassword };
      }),
    markAllNewUsersAsViewed: adminProcedure.mutation(async ({ ctx }) => {
      const { getAllUsers, getViewedUserIdsByAdmin, markUsersAsViewedByAdmin } =
        await import("./db");
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
        const { createUser, linkPropertyOwnersToUserByCpf } = await import(
          "./db"
        );
        await ensureUniqueUserIdentity(input.email, input.cpf);
        const leadLinkPreview = await getLeadLinkPreviewByCpf(input.cpf);

        if (leadLinkPreview && !input.confirmedLeadLink) {
          const interestLabel =
            leadLinkPreview.latestInterest || "Interesse nao informado";
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Esse usuario ja e um lead e tem interesse em: ${interestLabel}. O sistema vinculara o acesso de usuario ao lead.`,
          });
        }

        const passwordHash = await hashPassword(input.password);
        const normalizedCreci =
          input.role === "corretor"
            ? normalizeOptionalCreci(input.creci)
            : undefined;
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
        const linkedLeadPreview = await linkUserToExistingLeadsByCpf(
          createdUser.id,
          input.cpf
        );
        await linkPropertyOwnersToUserByCpf(createdUser.id, input.cpf);

        void sendWelcomeEmail({
          user: createdUser,
          req: ctx.req,
        }).catch(error => {
          console.error(
            "[Email] Falha ao enviar boas-vindas para novo usuario criado pelo admin",
            error
          );
        });

        return {
          user: toSafeUser(createdUser),
          linkedLeadPreview,
        };
      }),
    updateUser: adminProcedure
      .input(adminUpdateUserSchema)
      .mutation(async ({ ctx, input }) => {
        const { getUserById, updateUser } = await import("./db");
        const actingUser = await getUserById(ctx.user.id);
        const targetUser = await getUserById(input.id);

        if (!actingUser) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Usuario administrador nao encontrado",
          });
        }
        if (!targetUser) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Usuario nao encontrado",
          });
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
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Voce nao pode desativar sua propria conta",
          });
        }

        if (
          targetUser.role === "administrativo" &&
          targetUser.id !== ctx.user.id &&
          !actingIsRoot
        ) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "Apenas o proprio administrador ou o admin principal podem editar contas administrativas",
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
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Usuario nao encontrado",
          });
        }

        return toSafeUser(updatedUser);
      }),
    validateCreci: adminProcedure
      .input(adminValidateCreciSchema)
      .mutation(async ({ ctx, input }) => {
        const { getUserById, updateUser } = await import("./db");
        const user = await getUserById(input.userId);

        if (!user) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Usuario nao encontrado",
          });
        }

        if (user.role !== "corretor") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Somente corretores possuem CRECI",
          });
        }

        if (!user.creci || !isValidCreci(user.creci)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cadastre um CRECI valido antes de validar",
          });
        }

        await updateUser(input.userId, {
          creci: normalizeCreci(user.creci),
          creciStatus: "verified",
          creciVerifiedAt: new Date(),
          creciVerifiedByUserId: ctx.user.id,
        });

        const updatedUser = await getUserById(input.userId);
        if (!updatedUser) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Usuario nao encontrado",
          });
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
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Usuario administrador nao encontrado",
          });
        }
        if (!targetUser) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Usuario nao encontrado",
          });
        }

        const actingIsRoot = isRootAdmin(actingUser);
        const targetIsRoot = isRootAdmin(targetUser);

        if (targetIsRoot) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "O admin principal do sistema nao pode ser excluido",
          });
        }

        if (
          targetUser.role === "administrativo" &&
          targetUser.id !== ctx.user.id &&
          !actingIsRoot
        ) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "Apenas o admin principal pode excluir outros administradores",
          });
        }

        const linkedLeads = await getLeadsByUserId(targetUser.id);

        return {
          mode:
            targetUser.role === "administrativo"
              ? "revoke_access"
              : "delete_user",
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
    deleteUser: adminProcedure
      .input(adminDeleteUserSchema)
      .mutation(async ({ ctx, input }) => {
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
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Usuario administrador nao encontrado",
          });
        }
        if (!targetUser) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Usuario nao encontrado",
          });
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
              message:
                "Apenas o admin principal pode excluir outros administradores",
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
        const { getUserById, linkPropertyOwnersToUserByCpf, updateUser } =
          await import("./db");
        const actingUser = await getUserById(ctx.user.id);
        const user = await getUserById(input.id);

        if (!actingUser) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Usuario administrador nao encontrado",
          });
        }
        if (!user) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Usuario nao encontrado",
          });
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
            message:
              "Apenas o proprio administrador ou o admin principal podem editar contas administrativas",
          });
        }

        await ensureUniqueUserIdentity(input.email, input.cpf, input.id);
        const normalizedCreci =
          input.role === "corretor"
            ? normalizeOptionalCreci(input.creci)
            : undefined;

        await updateUser(input.id, {
          name: input.name.trim(),
          email: input.email,
          cpf: input.cpf,
          role: input.role,
          isActive: input.isActive,
          phone: input.phone?.trim() || null,
          creci: input.role === "corretor" ? normalizedCreci || null : null,
          creciStatus:
            input.role === "corretor" && normalizedCreci ? "verified" : null,
          creciVerifiedAt:
            input.role === "corretor" && normalizedCreci ? new Date() : null,
          creciVerifiedByUserId:
            input.role === "corretor" && normalizedCreci ? ctx.user.id : null,
          birthDate: input.birthDate
            ? new Date(`${input.birthDate}T00:00:00`)
            : null,
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
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Usuario nao encontrado",
          });
        }

        return toSafeUser(updatedUser);
      }),
    updatePropertyOwnerDetails: adminProcedure
      .input(propertyOwnerDetailsSchema)
      .mutation(async ({ input }) => {
        const {
          getPropertyOwnerByCpf,
          getPropertyOwnersByEmail,
          getUserByCpf,
          updatePropertyOwner,
        } = await import("./db");
        const duplicatedOwner = await getPropertyOwnerByCpf(input.cpf);

        if (duplicatedOwner && duplicatedOwner.id !== input.id) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "CPF ja cadastrado para outro proprietario",
          });
        }

        const ownersWithSameEmail = await getPropertyOwnersByEmail(input.email);
        const emailConflict = ownersWithSameEmail.find(
          owner => owner.id !== input.id && owner.cpf !== input.cpf
        );

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
          birthDate: input.birthDate
            ? new Date(`${input.birthDate}T00:00:00`)
            : null,
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
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Usuario administrador nao encontrado",
          });
        }
        if (
          targetUser &&
          isRootAdmin(targetUser) &&
          input.role !== "administrativo"
        ) {
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
            message:
              "Apenas o admin principal pode alterar outros administradores",
          });
        }

        return await updateUserRole(input.id, input.role);
      }),
  }),
});

export type AppRouter = typeof appRouter;

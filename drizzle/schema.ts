import { date, integer, pgTable, serial, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = pgTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: serial("id").primaryKey(),
  /** OAuth identifier (openId) returned from the authentication provider. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  cpf: varchar("cpf", { length: 14 }).unique(),
  phone: varchar("phone", { length: 20 }),
  creci: varchar("creci", { length: 32 }),
  creciStatus: varchar("creciStatus", { length: 20 }).$type<"pending" | "verified">(),
  creciVerifiedAt: timestamp("creciVerifiedAt", { mode: "date" }),
  creciVerifiedByUserId: integer("creciVerifiedByUserId"),
  birthDate: date("birthDate", { mode: "date" }),
  profession: varchar("profession", { length: 120 }),
  grossMonthlyIncome: integer("grossMonthlyIncome"),
  maritalStatus: varchar("maritalStatus", { length: 40 }),
  householdIncome: integer("householdIncome"),
  rg: varchar("rg", { length: 32 }),
  nationality: varchar("nationality", { length: 80 }),
  address: varchar("address", { length: 255 }),
  neighborhood: varchar("neighborhood", { length: 100 }),
  addressNumber: varchar("addressNumber", { length: 20 }),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 2 }),
  zipCode: varchar("zipCode", { length: 10 }),
  notes: text("notes"),
  loginMethod: varchar("loginMethod", { length: 64 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  registrationSource: varchar("registrationSource", { length: 32 })
    .$type<"public_signup" | "admin_created" | "bootstrap" | "oauth" | "legacy">()
    .default("legacy")
    .notNull(),
  role: varchar("role", { length: 20 })
    .$type<"cliente" | "corretor" | "administrativo">()
    .default("cliente")
    .notNull(),
  isActive: integer("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn", { mode: "date" }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const adminUserViews = pgTable(
  "adminUserViews",
  {
    id: serial("id").primaryKey(),
    adminUserId: integer("adminUserId").notNull(),
    viewedUserId: integer("viewedUserId").notNull(),
    viewedAt: timestamp("viewedAt", { mode: "date" }).defaultNow().notNull(),
  },
  table => [uniqueIndex("adminUserViews_adminUserId_viewedUserId_idx").on(table.adminUserId, table.viewedUserId)]
);

export type AdminUserView = typeof adminUserViews.$inferSelect;
export type InsertAdminUserView = typeof adminUserViews.$inferInsert;

export const propertyOwners = pgTable(
  "propertyOwners",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId"),
    name: varchar("name", { length: 120 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    cpf: varchar("cpf", { length: 14 }).notNull(),
    phone: varchar("phone", { length: 20 }).notNull(),
    notes: text("notes"),
    createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
  },
  table => [uniqueIndex("propertyOwners_cpf_idx").on(table.cpf)]
);

export type PropertyOwner = typeof propertyOwners.$inferSelect;
export type InsertPropertyOwner = typeof propertyOwners.$inferInsert;

/**
 * Tabela de condominios
 * Centraliza dados reaproveitaveis no cadastro de imoveis
 */
export const condominios = pgTable(
  "condominios",
  {
    id: serial("id").primaryKey(),
    nome: varchar("nome", { length: 180 }).notNull(),
    tipo: varchar("tipo", { length: 20 }).$type<"casa" | "apartamento">().notNull(),
    endereco: varchar("endereco", { length: 255 }).notNull(),
    numero: varchar("numero", { length: 20 }),
    complemento: varchar("complemento", { length: 120 }),
    bairro: varchar("bairro", { length: 100 }),
    cidade: varchar("cidade", { length: 100 }).notNull(),
    estado: varchar("estado", { length: 2 }).notNull(),
    cep: varchar("cep", { length: 10 }),
    referencia: text("referencia"),
    valorCondominio: integer("valorCondominio"),
    valorIptu: integer("valorIptu"),
    cnpj: varchar("cnpj", { length: 18 }),
    administradoraNome: varchar("administradoraNome", { length: 120 }),
    administradoraContato: varchar("administradoraContato", { length: 120 }),
    caracteristicas: text("caracteristicas"),
    observacoes: text("observacoes"),
    isAtivo: integer("isAtivo").default(1).notNull(),
    createdByUserId: integer("createdByUserId").notNull(),
    createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
  },
  table => [uniqueIndex("condominios_nome_cidade_idx").on(table.nome, table.cidade)]
);

export type Condominium = typeof condominios.$inferSelect;
export type InsertCondominium = typeof condominios.$inferInsert;

/**
 * Tabela de integracoes externas
 * Guarda configuracoes base para conectores atuais e futuros
 */
export const integrations = pgTable("integrations", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 140 }).notNull(),
  category: varchar("category", { length: 40 })
    .$type<"portal_divulgacao" | "financeiro" | "assinaturas_eletronicas" | "automacao" | "outro">()
    .notNull(),
  provider: varchar("provider", { length: 120 }).notNull(),
  connectionType: varchar("connectionType", { length: 30 })
    .$type<"api" | "webhook" | "arquivo" | "manual">()
    .notNull(),
  status: varchar("status", { length: 20 })
    .$type<"rascunho" | "ativo" | "inativo">()
    .default("rascunho")
    .notNull(),
  endpoint: text("endpoint"),
  apiKey: text("apiKey"),
  configJson: text("configJson"),
  notes: text("notes"),
  lastTestedAt: timestamp("lastTestedAt", { mode: "date" }),
  lastError: text("lastError"),
  createdByUserId: integer("createdByUserId").notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

export type Integration = typeof integrations.$inferSelect;
export type InsertIntegration = typeof integrations.$inferInsert;

/**
 * Tabela de imoveis
 * Armazena informacoes sobre os imoveis cadastrados no sistema
 */
export const properties = pgTable("properties", {
  id: serial("id").primaryKey(),
  titulo: varchar("titulo", { length: 255 }).notNull(),
  descricao: text("descricao"),
  tipo: varchar("tipo", { length: 50 }).notNull(), // casa, apartamento, terreno, comercial
  finalidade: varchar("finalidade", { length: 20 }).notNull(), // venda, locacao, ambos
  valor: integer("valor").notNull(), // valor em centavos
  valorLocacao: integer("valorLocacao"), // valor de locacao em centavos (se aplicavel)
  area: integer("area"), // area em m2
  quartos: integer("quartos"),
  banheiros: integer("banheiros"),
  vagas: integer("vagas"),
  endereco: varchar("endereco", { length: 255 }).notNull(),
  numero: varchar("numero", { length: 20 }),
  bairro: varchar("bairro", { length: 100 }),
  cidade: varchar("cidade", { length: 100 }).notNull(),
  estado: varchar("estado", { length: 2 }).notNull(),
  cep: varchar("cep", { length: 10 }),
  latitude: varchar("latitude", { length: 20 }),
  longitude: varchar("longitude", { length: 20 }),
  fotos: text("fotos"), // JSON array de URLs das fotos
  destaque: integer("destaque").default(0).notNull(), // 0 = nao, 1 = sim
  status: varchar("status", { length: 20 }).default("ativo").notNull(), // ativo, vendido, alugado, inativo
  keyStatus: varchar("keyStatus", { length: 20 })
    .$type<"disponivel" | "retirada" | "indisponivel">()
    .default("disponivel")
    .notNull(),
  keyStatusObservation: text("keyStatusObservation")
    .default("Chaves disponíveis na imobiliária.")
    .notNull(),
  keyStatusUpdatedByUserId: integer("keyStatusUpdatedByUserId"),
  keyStatusUpdatedAt: timestamp("keyStatusUpdatedAt", { mode: "date" }).defaultNow().notNull(),
  lixeira: integer("lixeira").default(0).notNull(),
  motivoExclusao: text("motivoExclusao"),
  excluidoPorUserId: integer("excluidoPorUserId"),
  excluidoAt: timestamp("excluidoAt", { mode: "date" }),
  inscricaoImobiliaria: varchar("inscricaoImobiliaria", { length: 120 }),
  matriculaRegistro: varchar("matriculaRegistro", { length: 120 }),
  cartorioRegistro: varchar("cartorioRegistro", { length: 160 }),
  registroMunicipal: varchar("registroMunicipal", { length: 120 }),
  informacoesLegais: text("informacoesLegais"),
  observacoesJuridicas: text("observacoesJuridicas"),
  emCondominio: integer("emCondominio").default(0).notNull(),
  tipoCondominio: varchar("tipoCondominio", { length: 20 }).$type<"casa" | "apartamento">(),
  idCondominio: integer("idCondominio"),
  idCorretor: integer("idCorretor").notNull(), // ID do corretor responsavel
  idProprietario: integer("idProprietario"),
  createdByUserId: integer("createdByUserId").notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

export type Property = typeof properties.$inferSelect;
export type InsertProperty = typeof properties.$inferInsert;

export const propertyKeyStatusRequests = pgTable("propertyKeyStatusRequests", {
  id: serial("id").primaryKey(),
  idImovel: integer("idImovel").notNull(),
  requestedByUserId: integer("requestedByUserId").notNull(),
  requestedStatus: varchar("requestedStatus", { length: 20 })
    .$type<"disponivel" | "retirada" | "indisponivel">()
    .notNull(),
  requestedObservation: text("requestedObservation").notNull(),
  status: varchar("status", { length: 20 })
    .$type<"pending" | "approved" | "rejected">()
    .default("pending")
    .notNull(),
  reviewedByUserId: integer("reviewedByUserId"),
  reviewNote: text("reviewNote"),
  reviewedAt: timestamp("reviewedAt", { mode: "date" }),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

export type PropertyKeyStatusRequest = typeof propertyKeyStatusRequests.$inferSelect;
export type InsertPropertyKeyStatusRequest = typeof propertyKeyStatusRequests.$inferInsert;

/**
 * Tabela de leads do CRM
 * Armazena informacoes sobre potenciais clientes
 */
export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  cpf: varchar("cpf", { length: 14 }),
  birthDate: date("birthDate", { mode: "date" }),
  telefone: varchar("telefone", { length: 20 }),
  origem: varchar("origem", { length: 100 }), // site, whatsapp, indicacao, etc
  interesse: text("interesse"), // descricao do interesse
  observacao: text("observacao"), // observacoes sobre o lead
  status: varchar("status", { length: 50 }).default("novo").notNull(), // novo, atendimento, proposta, negociacao, fechado, perdidos
  userId: integer("userId"), // conta vinculada por CPF quando existir
  idResponsavel: integer("idResponsavel"), // ID do corretor/admin responsavel
  idImovel: integer("idImovel"), // ID do imovel de interesse (opcional)
  assignmentCycleStartedAt: timestamp("assignmentCycleStartedAt", { mode: "date" }).defaultNow().notNull(),
  assignedAt: timestamp("assignedAt", { mode: "date" }),
  attendedAt: timestamp("attendedAt", { mode: "date" }),
  assignmentSlaNotifiedAt: timestamp("assignmentSlaNotifiedAt", { mode: "date" }),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;

/**
 * Tabela de anotacoes de leads
 * Armazena o historico de interacoes com cada lead
 */
export const leadNotes = pgTable("leadNotes", {
  id: serial("id").primaryKey(),
  idLead: integer("idLead").notNull(),
  idUsuario: integer("idUsuario").notNull(), // quem fez a anotacao
  anotacao: text("anotacao").notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

export type LeadNote = typeof leadNotes.$inferSelect;
export type InsertLeadNote = typeof leadNotes.$inferInsert;

/**
 * Tabela de arquivos de leads
 * Armazena documentos e arquivos relacionados aos leads
 */
export const leadFiles = pgTable("leadFiles", {
  id: serial("id").primaryKey(),
  idLead: integer("idLead").notNull(),
  idUsuario: integer("idUsuario").notNull(), // quem fez o upload
  nomeArquivo: varchar("nomeArquivo", { length: 255 }).notNull(),
  urlArquivo: varchar("urlArquivo", { length: 500 }).notNull(),
  tipoArquivo: varchar("tipoArquivo", { length: 100 }),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

export type LeadFile = typeof leadFiles.$inferSelect;
export type InsertLeadFile = typeof leadFiles.$inferInsert;

/**
 * Tabela de historico de interacoes dos leads
 * Registra trilha de eventos operacionais e automacoes de SLA
 */
export const leadInteractions = pgTable("leadInteractions", {
  id: serial("id").primaryKey(),
  idLead: integer("idLead").notNull(),
  idUsuario: integer("idUsuario"),
  eventType: varchar("eventType", { length: 80 }).notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

export type LeadInteraction = typeof leadInteractions.$inferSelect;
export type InsertLeadInteraction = typeof leadInteractions.$inferInsert;

/**
 * Tabela de tarefas e eventos internos
 * Auxilia o dia a dia operacional entre os usuarios do sistema
 */
export const taskItems = pgTable("taskItems", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 180 }).notNull(),
  kind: varchar("kind", { length: 20 })
    .$type<"tarefa" | "evento">()
    .default("tarefa")
    .notNull(),
  sector: varchar("sector", { length: 40 })
    .$type<"administrativo" | "financeiro" | "atendimento" | "comercial" | "juridico">()
    .default("administrativo")
    .notNull(),
  status: varchar("status", { length: 20 })
    .$type<"pendente" | "em_andamento" | "concluida">()
    .default("pendente")
    .notNull(),
  dueAt: timestamp("dueAt", { mode: "date" }),
  description: text("description"),
  createdByUserId: integer("createdByUserId").notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

export type TaskItem = typeof taskItems.$inferSelect;
export type InsertTaskItem = typeof taskItems.$inferInsert;

/**
 * Modelos de registro para acelerar criacao de tarefas/eventos
 */
export const taskItemTemplates = pgTable("taskItemTemplates", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  kind: varchar("kind", { length: 20 })
    .$type<"tarefa" | "evento">()
    .notNull(),
  sector: varchar("sector", { length: 40 })
    .$type<"administrativo" | "financeiro" | "atendimento" | "comercial" | "juridico">()
    .notNull(),
  defaultTitle: varchar("defaultTitle", { length: 180 }).notNull(),
  defaultDescription: text("defaultDescription"),
  createdByUserId: integer("createdByUserId").notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

export type TaskItemTemplate = typeof taskItemTemplates.$inferSelect;
export type InsertTaskItemTemplate = typeof taskItemTemplates.$inferInsert;

/**
 * Vinculos de usuarios associados a tarefa/evento
 */
export const taskItemAssignments = pgTable(
  "taskItemAssignments",
  {
    id: serial("id").primaryKey(),
    taskId: integer("taskId").notNull(),
    userId: integer("userId").notNull(),
    createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  },
  table => [uniqueIndex("taskItemAssignments_taskId_userId_idx").on(table.taskId, table.userId)]
);

export type TaskItemAssignment = typeof taskItemAssignments.$inferSelect;
export type InsertTaskItemAssignment = typeof taskItemAssignments.$inferInsert;

/**
 * Observacoes em texto para tarefas/eventos
 */
export const taskItemNotes = pgTable("taskItemNotes", {
  id: serial("id").primaryKey(),
  taskId: integer("taskId").notNull(),
  userId: integer("userId").notNull(),
  note: text("note").notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

export type TaskItemNote = typeof taskItemNotes.$inferSelect;
export type InsertTaskItemNote = typeof taskItemNotes.$inferInsert;

/**
 * Tabela de contratos
 * Armazena informacoes sobre contratos de clientes
 */
export const contracts = pgTable("contracts", {
  id: serial("id").primaryKey(),
  idCliente: integer("idCliente").notNull(),
  idImovel: integer("idImovel").notNull(),
  tipo: varchar("tipo", { length: 20 }).notNull(), // venda, locacao
  valor: integer("valor").notNull(), // valor em centavos
  dataInicio: timestamp("dataInicio", { mode: "date" }).notNull(),
  dataFim: timestamp("dataFim", { mode: "date" }),
  status: varchar("status", { length: 20 }).default("ativo").notNull(), // ativo, encerrado, cancelado
  urlContrato: varchar("urlContrato", { length: 500 }), // URL do PDF do contrato
  observacoes: text("observacoes"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

export type Contract = typeof contracts.$inferSelect;
export type InsertContract = typeof contracts.$inferInsert;

/**
 * Modelos de contratos cadastrados pelo administrativo.
 * Guardam o PDF base, texto extraido e marcacoes variaveis revisadas.
 */
export const contractTemplates = pgTable("contractTemplates", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 180 }).notNull(),
  notes: text("notes"),
  originalFileName: varchar("originalFileName", { length: 255 }).notNull(),
  originalMimeType: varchar("originalMimeType", { length: 120 }).notNull(),
  originalFileData: text("originalFileData").notNull(),
  extractedText: text("extractedText").notNull(),
  reviewedText: text("reviewedText").notNull(),
  variableHighlights: text("variableHighlights").default("[]").notNull(),
  createdByUserId: integer("createdByUserId").notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

export type ContractTemplate = typeof contractTemplates.$inferSelect;
export type InsertContractTemplate = typeof contractTemplates.$inferInsert;

/**
 * Tabela de documentos de imoveis
 * Armazena PDFs relacionados a cada imovel
 */
export const propertyDocuments = pgTable("propertyDocuments", {
  id: serial("id").primaryKey(),
  idImovel: integer("idImovel").notNull(),
  idUsuario: integer("idUsuario").notNull(),
  nomeArquivo: varchar("nomeArquivo", { length: 255 }).notNull(),
  urlArquivo: text("urlArquivo").notNull(),
  tipoArquivo: varchar("tipoArquivo", { length: 120 }).notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

export type PropertyDocument = typeof propertyDocuments.$inferSelect;
export type InsertPropertyDocument = typeof propertyDocuments.$inferInsert;

/**
 * Tabela de documentos de clientes
 * Armazena documentos enviados pelos clientes
 */
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  idUsuario: integer("idUsuario").notNull(),
  nomeArquivo: varchar("nomeArquivo", { length: 255 }).notNull(),
  urlArquivo: varchar("urlArquivo", { length: 500 }).notNull(),
  tipo: varchar("tipo", { length: 100 }).notNull(), // rg, cpf, comprovante_residencia, etc
  status: varchar("status", { length: 20 }).default("pendente").notNull(), // pendente, aprovado, rejeitado
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

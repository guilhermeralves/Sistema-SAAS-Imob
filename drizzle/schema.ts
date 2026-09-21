import {
  date,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

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
  creciStatus: varchar("creciStatus", { length: 20 }).$type<
    "pending" | "verified"
  >(),
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
    .$type<
      "public_signup" | "admin_created" | "bootstrap" | "oauth" | "legacy"
    >()
    .default("legacy")
    .notNull(),
  role: varchar("role", { length: 20 })
    .$type<"cliente" | "corretor" | "administrativo">()
    .default("cliente")
    .notNull(),
  isActive: integer("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn", { mode: "date" })
    .defaultNow()
    .notNull(),
  // Última vez que o usuário abriu a tela de Tarefas e Eventos. Usado para o
  // badge do calendário contar apenas tarefas/eventos novos (ainda não vistos).
  tasksSeenAt: timestamp("tasksSeenAt", { mode: "date" }),
  // ID deste usuário como "manager" (atendente) no BotConversa. Quando
  // preenchido, o sistema transfere automaticamente a conversa do lead
  // para esse manager no painel do BotConversa.
  botconversaManagerId: varchar("botconversaManagerId", { length: 64 }),
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
  table => [
    uniqueIndex("adminUserViews_adminUserId_viewedUserId_idx").on(
      table.adminUserId,
      table.viewedUserId
    ),
  ]
);

export type AdminUserView = typeof adminUserViews.$inferSelect;
export type InsertAdminUserView = typeof adminUserViews.$inferInsert;

/**
 * Inscrições de Web Push por usuário. Cada aparelho/navegador gera um endpoint
 * único; um mesmo usuário pode ter várias inscrições (celular, desktop, etc.).
 */
export const pushSubscriptions = pgTable(
  "pushSubscriptions",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: varchar("userAgent", { length: 255 }),
    createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  },
  table => [uniqueIndex("pushSubscriptions_endpoint_idx").on(table.endpoint)]
);

export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = typeof pushSubscriptions.$inferInsert;

/**
 * Histórico de notificações por usuário (alimenta o sino no cabeçalho).
 * Persistido sempre que o sistema notifica o usuário, independente do push.
 */
export const userNotifications = pgTable("userNotifications", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  title: varchar("title", { length: 160 }).notNull(),
  body: text("body").notNull(),
  url: varchar("url", { length: 512 }),
  isRead: integer("isRead").default(0).notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

export type UserNotification = typeof userNotifications.$inferSelect;
export type InsertUserNotification = typeof userNotifications.$inferInsert;

export const propertyOwners = pgTable(
  "propertyOwners",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId"),
    name: varchar("name", { length: 120 }).notNull(),
    email: varchar("email", { length: 255 }),
    cpf: varchar("cpf", { length: 14 }),
    phone: varchar("phone", { length: 20 }).notNull(),
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
    tipo: varchar("tipo", { length: 20 })
      .$type<"casa" | "apartamento">()
      .notNull(),
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
  table => [
    uniqueIndex("condominios_nome_cidade_idx").on(table.nome, table.cidade),
  ]
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
    .$type<
      | "portal_divulgacao"
      | "financeiro"
      | "assinaturas_eletronicas"
      | "automacao"
      | "outro"
    >()
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
  keyStatusUpdatedAt: timestamp("keyStatusUpdatedAt", { mode: "date" })
    .defaultNow()
    .notNull(),
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
  tipoCondominio: varchar("tipoCondominio", { length: 20 }).$type<
    "casa" | "apartamento"
  >(),
  idCondominio: integer("idCondominio"),
  parceria: integer("parceria").default(0).notNull(),
  parceriaNome: varchar("parceriaNome", { length: 160 }),
  parceriaTelefone: varchar("parceriaTelefone", { length: 20 }),
  parceriaReferencia: varchar("parceriaReferencia", { length: 120 }),
  idCorretor: integer("idCorretor").notNull(), // ID do corretor responsavel
  idProprietario: integer("idProprietario"),
  createdByUserId: integer("createdByUserId").notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

export type Property = typeof properties.$inferSelect;
export type InsertProperty = typeof properties.$inferInsert;

/**
 * Tabela de lancamentos imobiliarios
 * Armazena empreendimentos na planta e suas faixas de unidades.
 */
export const propertyLaunches = pgTable("propertyLaunches", {
  id: serial("id").primaryKey(),
  nome: varchar("nome", { length: 180 }).notNull(),
  descricao: text("descricao"),
  construtora: varchar("construtora", { length: 160 }),
  tipo: varchar("tipo", { length: 50 }).notNull(),
  status: varchar("status", { length: 30 }).default("lancamento").notNull(),
  entregaPrevista: date("entregaPrevista", { mode: "date" }),
  valorMin: integer("valorMin").notNull(),
  valorMax: integer("valorMax"),
  areaMin: integer("areaMin"),
  areaMax: integer("areaMax"),
  quartosMin: integer("quartosMin"),
  quartosMax: integer("quartosMax"),
  vagasMin: integer("vagasMin"),
  vagasMax: integer("vagasMax"),
  unidadesDisponiveis: integer("unidadesDisponiveis"),
  endereco: varchar("endereco", { length: 255 }).notNull(),
  numero: varchar("numero", { length: 20 }),
  bairro: varchar("bairro", { length: 100 }),
  cidade: varchar("cidade", { length: 100 }).notNull(),
  estado: varchar("estado", { length: 2 }).notNull(),
  cep: varchar("cep", { length: 10 }),
  fotos: text("fotos"),
  numeroTorres: integer("numeroTorres"),
  /** JSON array de strings com os identificadores dos blocos/torres
   * (ex: ["Torre A", "Torre B"] ou ["Bloco 1", "Bloco 2"]). */
  identificadoresTorres: text("identificadoresTorres"),
  numeroPavimentos: integer("numeroPavimentos"),
  unidadesPorPavimento: integer("unidadesPorPavimento"),
  totalUnidades: integer("totalUnidades"),
  // Contadores comerciais. Somados devem bater com totalUnidades.
  // Poderão migrar para SUM() de uma tabela launchUnits quando o
  // controle passar a ser por unidade individual.
  unidadesReservadas: integer("unidadesReservadas").default(0).notNull(),
  unidadesEmNegociacao: integer("unidadesEmNegociacao").default(0).notNull(),
  unidadesVendidas: integer("unidadesVendidas").default(0).notNull(),
  /** 1 = sim, 0 = não, null = não informado */
  temElevadores: integer("temElevadores"),
  elevadoresPorTorre: integer("elevadoresPorTorre"),
  // JSON array de strings com as áreas comuns marcadas (piscina,
  // academia, etc.). Guardar como text simplifica queries/serialization.
  areasComuns: text("areasComuns"),
  destaque: integer("destaque").default(0).notNull(),
  isAtivo: integer("isAtivo").default(1).notNull(),
  createdByUserId: integer("createdByUserId"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

export type PropertyLaunch = typeof propertyLaunches.$inferSelect;
export type InsertPropertyLaunch = typeof propertyLaunches.$inferInsert;

/**
 * Arquivos anexados a um lançamento (PDFs, plantas, book, imagens
 * adicionais além da foto de capa). Armazenados em uploads/launch-files/
 * e servidos via rota pública /api/media/launch-files/:fileName.
 */
export const launchFiles = pgTable("launchFiles", {
  id: serial("id").primaryKey(),
  launchId: integer("launchId").notNull(),
  fileName: varchar("fileName", { length: 128 }).notNull(),
  originalName: varchar("originalName", { length: 255 }).notNull(),
  url: varchar("url", { length: 500 }).notNull(),
  mimeType: varchar("mimeType", { length: 120 }).notNull(),
  sizeBytes: integer("sizeBytes").notNull(),
  uploadedByUserId: integer("uploadedByUserId"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

export type LaunchFile = typeof launchFiles.$inferSelect;
export type InsertLaunchFile = typeof launchFiles.$inferInsert;

export const propertyOwnerLinks = pgTable(
  "propertyOwnerLinks",
  {
    id: serial("id").primaryKey(),
    propertyId: integer("propertyId").notNull(),
    ownerId: integer("ownerId").notNull(),
    position: integer("position").default(1).notNull(),
    createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  },
  table => [
    uniqueIndex("propertyOwnerLinks_unique_idx").on(
      table.propertyId,
      table.ownerId
    ),
  ]
);

export type PropertyOwnerLink = typeof propertyOwnerLinks.$inferSelect;
export type InsertPropertyOwnerLink = typeof propertyOwnerLinks.$inferInsert;

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

export type PropertyKeyStatusRequest =
  typeof propertyKeyStatusRequests.$inferSelect;
export type InsertPropertyKeyStatusRequest =
  typeof propertyKeyStatusRequests.$inferInsert;

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
  // ID do contato (subscriber) no BotConversa. Guardado para chamar a API
  // do BotConversa (transferir conversa, marcar como atendido, etc).
  botconversaSubscriberId: varchar("botconversaSubscriberId", { length: 64 }),
  // Quando o lead deve ser distribuído pela roleta e transferido ao
  // corretor no BotConversa. Preenchido pelo webhook com now + delay da fila.
  // Enquanto null ou futuro, o SLA scheduler não distribui.
  distributeAfter: timestamp("distributeAfter", { mode: "date" }),
  assignmentCycleStartedAt: timestamp("assignmentCycleStartedAt", {
    mode: "date",
  })
    .defaultNow()
    .notNull(),
  assignedAt: timestamp("assignedAt", { mode: "date" }),
  attendedAt: timestamp("attendedAt", { mode: "date" }),
  assignmentSlaNotifiedAt: timestamp("assignmentSlaNotifiedAt", {
    mode: "date",
  }),
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
    .$type<
      "administrativo" | "financeiro" | "atendimento" | "comercial" | "juridico"
    >()
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
  kind: varchar("kind", { length: 20 }).$type<"tarefa" | "evento">().notNull(),
  sector: varchar("sector", { length: 40 })
    .$type<
      "administrativo" | "financeiro" | "atendimento" | "comercial" | "juridico"
    >()
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
  table => [
    uniqueIndex("taskItemAssignments_taskId_userId_idx").on(
      table.taskId,
      table.userId
    ),
  ]
);

export type TaskItemAssignment = typeof taskItemAssignments.$inferSelect;
export type InsertTaskItemAssignment = typeof taskItemAssignments.$inferInsert;

/**
 * Marca quais tarefas/eventos cada usuario ja abriu (visualizou os detalhes).
 * Usado para o badge do calendario contar apenas os itens ainda nao vistos e
 * decrementar um a um conforme o usuario abre cada tarefa.
 */
export const taskItemViews = pgTable(
  "taskItemViews",
  {
    id: serial("id").primaryKey(),
    taskId: integer("taskId").notNull(),
    userId: integer("userId").notNull(),
    viewedAt: timestamp("viewedAt", { mode: "date" }).defaultNow().notNull(),
  },
  table => [
    uniqueIndex("taskItemViews_taskId_userId_idx").on(
      table.taskId,
      table.userId
    ),
  ]
);

export type TaskItemView = typeof taskItemViews.$inferSelect;
export type InsertTaskItemView = typeof taskItemViews.$inferInsert;

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
  contractKind: varchar("contractKind", { length: 30 })
    .$type<"locacao" | "venda" | "outro">()
    .default("locacao")
    .notNull(),
  participantRoles: text("participantRoles")
    .default('["locatario","proprietario","corretor","imovel","locacao"]')
    .notNull(),
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
 * Processos de locacao iniciados pelo administrativo.
 * Centralizam o contexto antes de virar contrato ativo.
 */
export const rentalProposals = pgTable("rentalProposals", {
  id: serial("id").primaryKey(),
  status: varchar("status", { length: 40 })
    .$type<
      | "rascunho"
      | "contratos_em_revisao"
      | "boletos_pendentes"
      | "seguros_pendentes"
      | "assinaturas_pendentes"
      | "transferencias_pendentes"
      | "vistoria_pendente"
      | "entrega_chaves_pendente"
      | "ativo"
      | "cancelado"
    >()
    .default("rascunho")
    .notNull(),
  currentStep: varchar("currentStep", { length: 60 })
    .default("dados_iniciais")
    .notNull(),
  propertyId: integer("propertyId").notNull(),
  ownerId: integer("ownerId"),
  brokerUserId: integer("brokerUserId").notNull(),
  tenantUserId: integer("tenantUserId").notNull(),
  ownerConfirmedAt: timestamp("ownerConfirmedAt", { mode: "date" }),
  tenantConfirmedAt: timestamp("tenantConfirmedAt", { mode: "date" }),
  leaseTermMonths: integer("leaseTermMonths").notNull(),
  adjustmentIndex: varchar("adjustmentIndex", { length: 40 }).notNull(),
  adjustmentPeriod: varchar("adjustmentPeriod", { length: 20 }).$type<
    "anual" | "mensal"
  >(),
  administrationFeePercent: integer("administrationFeePercent"),
  transferBusinessDays: integer("transferBusinessDays"),
  terminationPenaltyType: varchar("terminationPenaltyType", {
    length: 20,
  }).$type<"valor" | "alugueis">(),
  terminationPenaltyAmount: integer("terminationPenaltyAmount"),
  rentAmount: integer("rentAmount").notNull(),
  condominiumAmount: integer("condominiumAmount"),
  startDate: date("startDate", { mode: "date" }).notNull(),
  dueDay: integer("dueDay").notNull(),
  contextSnapshot: text("contextSnapshot").default("{}").notNull(),
  referenceCode: varchar("referenceCode", { length: 40 }),
  notes: text("notes"),
  createdByUserId: integer("createdByUserId").notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

export type RentalProposal = typeof rentalProposals.$inferSelect;
export type InsertRentalProposal = typeof rentalProposals.$inferInsert;

export const rentalProposalTenants = pgTable(
  "rentalProposalTenants",
  {
    id: serial("id").primaryKey(),
    rentalProposalId: integer("rentalProposalId").notNull(),
    tenantUserId: integer("tenantUserId").notNull(),
    position: integer("position").default(1).notNull(),
    createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  },
  table => [
    uniqueIndex("rentalProposalTenants_unique_idx").on(
      table.rentalProposalId,
      table.tenantUserId
    ),
  ]
);

export type RentalProposalTenant = typeof rentalProposalTenants.$inferSelect;
export type InsertRentalProposalTenant =
  typeof rentalProposalTenants.$inferInsert;

export const rentalProposalOwners = pgTable(
  "rentalProposalOwners",
  {
    id: serial("id").primaryKey(),
    rentalProposalId: integer("rentalProposalId").notNull(),
    ownerId: integer("ownerId").notNull(),
    position: integer("position").default(1).notNull(),
    createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  },
  table => [
    uniqueIndex("rentalProposalOwners_unique_idx").on(
      table.rentalProposalId,
      table.ownerId
    ),
  ]
);

export type RentalProposalOwner = typeof rentalProposalOwners.$inferSelect;
export type InsertRentalProposalOwner =
  typeof rentalProposalOwners.$inferInsert;

export const rentalProposalContractTemplates = pgTable(
  "rentalProposalContractTemplates",
  {
    id: serial("id").primaryKey(),
    rentalProposalId: integer("rentalProposalId").notNull(),
    contractTemplateId: integer("contractTemplateId").notNull(),
    position: integer("position").default(1).notNull(),
    createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  },
  table => [
    uniqueIndex("rentalProposalContractTemplates_unique_idx").on(
      table.rentalProposalId,
      table.contractTemplateId
    ),
  ]
);

export type RentalProposalContractTemplate =
  typeof rentalProposalContractTemplates.$inferSelect;
export type InsertRentalProposalContractTemplate =
  typeof rentalProposalContractTemplates.$inferInsert;

export const rentalProposalGeneratedContracts = pgTable(
  "rentalProposalGeneratedContracts",
  {
    id: serial("id").primaryKey(),
    rentalProposalId: integer("rentalProposalId").notNull(),
    contractTemplateId: integer("contractTemplateId").notNull(),
    status: varchar("status", { length: 40 })
      .$type<"em_revisao" | "aprovado">()
      .default("em_revisao")
      .notNull(),
    title: varchar("title", { length: 180 }).notNull(),
    generatedText: text("generatedText").notNull(),
    reviewedText: text("reviewedText").notNull(),
    variableValues: text("variableValues").default("{}").notNull(),
    unresolvedVariables: text("unresolvedVariables").default("[]").notNull(),
    generatedAt: timestamp("generatedAt", { mode: "date" })
      .defaultNow()
      .notNull(),
    approvedAt: timestamp("approvedAt", { mode: "date" }),
    approvedByUserId: integer("approvedByUserId"),
    createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
  },
  table => [
    uniqueIndex("rentalProposalGeneratedContracts_unique_idx").on(
      table.rentalProposalId,
      table.contractTemplateId
    ),
  ]
);

export type RentalProposalGeneratedContract =
  typeof rentalProposalGeneratedContracts.$inferSelect;
export type InsertRentalProposalGeneratedContract =
  typeof rentalProposalGeneratedContracts.$inferInsert;

export const rentalProposalBoletos = pgTable(
  "rentalProposalBoletos",
  {
    id: serial("id").primaryKey(),
    rentalProposalId: integer("rentalProposalId").notNull(),
    installmentNumber: integer("installmentNumber").notNull(),
    referenceMonth: date("referenceMonth", { mode: "date" }).notNull(),
    dueDate: date("dueDate", { mode: "date" }).notNull(),
    rentAmount: integer("rentAmount").notNull(),
    condominiumAmount: integer("condominiumAmount"),
    extraAmount: integer("extraAmount").default(0).notNull(),
    extraDescription: varchar("extraDescription", { length: 180 }),
    totalAmount: integer("totalAmount").notNull(),
    status: varchar("status", { length: 20 })
      .$type<"pendente" | "aprovado">()
      .default("pendente")
      .notNull(),
    notes: text("notes"),
    approvedAt: timestamp("approvedAt", { mode: "date" }),
    approvedByUserId: integer("approvedByUserId"),
    paidAt: timestamp("paidAt", { mode: "date" }),
    createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
  },
  table => [
    uniqueIndex("rentalProposalBoletos_unique_idx").on(
      table.rentalProposalId,
      table.installmentNumber
    ),
  ]
);

export type RentalProposalBoleto = typeof rentalProposalBoletos.$inferSelect;
export type InsertRentalProposalBoleto =
  typeof rentalProposalBoletos.$inferInsert;

/**
 * Seguros exigidos na etapa pos-boletos de uma proposta de locacao. Uma linha
 * por (proposta, tipo), onde tipo e "fianca" (seguro fianca) ou "incendio"
 * (seguro incendio). O administrativo confirma o recebimento do comprovante da
 * primeira parcela (com anexo opcional em base64) ou dispensa o seguro quando
 * nao se aplica (ex.: locacao com fiador no lugar de seguro fianca).
 */
export const rentalProposalInsurances = pgTable(
  "rentalProposalInsurances",
  {
    id: serial("id").primaryKey(),
    rentalProposalId: integer("rentalProposalId").notNull(),
    kind: varchar("kind", { length: 20 })
      .$type<"fianca" | "incendio">()
      .notNull(),
    status: varchar("status", { length: 20 })
      .$type<"pendente" | "confirmado" | "dispensado">()
      .default("pendente")
      .notNull(),
    insurer: varchar("insurer", { length: 160 }),
    policyNumber: varchar("policyNumber", { length: 80 }),
    amount: integer("amount"),
    proofData: text("proofData"),
    proofFileName: varchar("proofFileName", { length: 255 }),
    proofContentType: varchar("proofContentType", { length: 120 }),
    notes: text("notes"),
    requestedAt: timestamp("requestedAt", { mode: "date" }),
    confirmedAt: timestamp("confirmedAt", { mode: "date" }),
    confirmedByUserId: integer("confirmedByUserId"),
    createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
  },
  table => [
    uniqueIndex("rentalProposalInsurances_unique_idx").on(
      table.rentalProposalId,
      table.kind
    ),
  ]
);

export type RentalProposalInsurance =
  typeof rentalProposalInsurances.$inferSelect;
export type InsertRentalProposalInsurance =
  typeof rentalProposalInsurances.$inferInsert;

/**
 * Assinaturas digitais dos contratos de uma proposta de locacao (etapa 24).
 * Uma linha por contrato gerado/aprovado (chave unica proposta+contrato).
 * O contrato aprovado e enviado a um provedor de assinatura (hoje D4Sign);
 * guardamos o identificador externo do documento, o status e, ao concluir,
 * o PDF assinado baixado do provedor. Os signatarios (locatarios e
 * proprietarios) sao registrados num snapshot para auditoria.
 */
export const rentalProposalSignatures = pgTable(
  "rentalProposalSignatures",
  {
    id: serial("id").primaryKey(),
    rentalProposalId: integer("rentalProposalId").notNull(),
    generatedContractId: integer("generatedContractId").notNull(),
    provider: varchar("provider", { length: 20 })
      .$type<"d4sign">()
      .default("d4sign")
      .notNull(),
    environment: varchar("environment", { length: 20 }).$type<
      "sandbox" | "production"
    >(),
    status: varchar("status", { length: 20 })
      .$type<"pendente" | "enviado" | "assinado" | "cancelado" | "erro">()
      .default("pendente")
      .notNull(),
    // UUID do documento no provedor (D4Sign).
    externalDocumentUuid: varchar("externalDocumentUuid", { length: 80 }),
    // Snapshot JSON dos signatarios enviados (papel, nome, e-mail).
    signersSnapshot: text("signersSnapshot"),
    // PDF assinado baixado do provedor (data URL base64) ao finalizar.
    signedFileData: text("signedFileData"),
    signedFileName: varchar("signedFileName", { length: 255 }),
    lastError: text("lastError"),
    sentAt: timestamp("sentAt", { mode: "date" }),
    signedAt: timestamp("signedAt", { mode: "date" }),
    sentByUserId: integer("sentByUserId"),
    createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
  },
  table => [
    uniqueIndex("rentalProposalSignatures_unique_idx").on(
      table.rentalProposalId,
      table.generatedContractId
    ),
  ]
);

export type RentalProposalSignature =
  typeof rentalProposalSignatures.$inferSelect;
export type InsertRentalProposalSignature =
  typeof rentalProposalSignatures.$inferInsert;

/**
 * Transferencia de titularidade das contas de consumo (etapas 25-26).
 * Uma linha por (proposta, tipo): "energia", "agua" ou "gas". O locatario
 * transfere a titularidade e envia o comprovante; o administrativo confirma
 * (com anexo opcional) ou dispensa quando nao se aplica (ex.: sem gas encanado).
 */
export const rentalProposalUtilityTransfers = pgTable(
  "rentalProposalUtilityTransfers",
  {
    id: serial("id").primaryKey(),
    rentalProposalId: integer("rentalProposalId").notNull(),
    // "energia", "agua", "gas" (padrao) ou um slug "custom_xxx" para contas
    // personalizadas adicionadas pelo administrativo.
    kind: varchar("kind", { length: 40 }).$type<string>().notNull(),
    // Rotulo amigavel; para contas personalizadas guarda o nome digitado.
    label: varchar("label", { length: 160 }),
    status: varchar("status", { length: 20 })
      .$type<"pendente" | "confirmado" | "dispensado">()
      .default("pendente")
      .notNull(),
    proofData: text("proofData"),
    proofFileName: varchar("proofFileName", { length: 255 }),
    proofContentType: varchar("proofContentType", { length: 120 }),
    notes: text("notes"),
    requestedAt: timestamp("requestedAt", { mode: "date" }),
    confirmedAt: timestamp("confirmedAt", { mode: "date" }),
    confirmedByUserId: integer("confirmedByUserId"),
    createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
  },
  table => [
    uniqueIndex("rentalProposalUtilityTransfers_unique_idx").on(
      table.rentalProposalId,
      table.kind
    ),
  ]
);

export type RentalProposalUtilityTransfer =
  typeof rentalProposalUtilityTransfers.$inferSelect;
export type InsertRentalProposalUtilityTransfer =
  typeof rentalProposalUtilityTransfers.$inferInsert;

/**
 * Vistoria e laudo (etapas 27-28). Um registro por proposta. O administrativo
 * informa o contato do vistoriador (externo, sem login) e solicita a vistoria
 * (notificacao por wa.me/e-mail). Depois anexa o laudo e marca a validacao do
 * estado do imovel pelo locatario e pelo proprietario.
 */
export const rentalProposalInspections = pgTable("rentalProposalInspections", {
  id: serial("id").primaryKey(),
  rentalProposalId: integer("rentalProposalId").notNull().unique(),
  status: varchar("status", { length: 20 })
    .$type<"pendente" | "solicitada" | "concluida">()
    .default("pendente")
    .notNull(),
  inspectorName: varchar("inspectorName", { length: 160 }),
  inspectorPhone: varchar("inspectorPhone", { length: 40 }),
  inspectorEmail: varchar("inspectorEmail", { length: 255 }),
  scheduledAt: date("scheduledAt", { mode: "date" }),
  requestedAt: timestamp("requestedAt", { mode: "date" }),
  // Laudo de vistoria (data URL base64) + metadados.
  laudoData: text("laudoData"),
  laudoFileName: varchar("laudoFileName", { length: 255 }),
  laudoContentType: varchar("laudoContentType", { length: 120 }),
  tenantValidatedAt: timestamp("tenantValidatedAt", { mode: "date" }),
  ownerValidatedAt: timestamp("ownerValidatedAt", { mode: "date" }),
  // Selfie (data URL base64) capturada no app por cada parte ao validar.
  tenantSelfieData: text("tenantSelfieData"),
  ownerSelfieData: text("ownerSelfieData"),
  // Usuario cliente logado que realizou cada validacao.
  tenantValidatedByUserId: integer("tenantValidatedByUserId"),
  ownerValidatedByUserId: integer("ownerValidatedByUserId"),
  // Tokens dos links de validacao (um por parte) enviados ao locatario/proprietario.
  tenantValidationToken: varchar("tenantValidationToken", { length: 40 }),
  ownerValidationToken: varchar("ownerValidationToken", { length: 40 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

export type RentalProposalInspection =
  typeof rentalProposalInspections.$inferSelect;
export type InsertRentalProposalInspection =
  typeof rentalProposalInspections.$inferInsert;

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

/**
 * Filas da Roleta de Atendimentos.
 *
 * Cada fila é uma "roleta" com suas regras de ordem e tempo. Corretores com
 * permissão (attendanceQueueMembers) podem entrar na fila; quem está ativo vira
 * participante (attendanceQueueParticipants) e recebe leads em rodízio.
 *
 * `tenantId` fica reservado (nullable) para o futuro multi-imobiliária: hoje o
 * piloto inicial opera como tenant único, então permanece nulo.
 */
export const attendanceQueues = pgTable("attendanceQueues", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId"),
  name: varchar("name", { length: 120 }).notNull(),
  description: text("description"),
  isActive: integer("isActive").default(1).notNull(),
  // Marca a "roleta padrão" que recebe os leads quando nenhuma fila específica
  // é indicada. Só uma fila deve ficar como padrão por tenant.
  isDefault: integer("isDefault").default(0).notNull(),
  orderStrategy: varchar("orderStrategy", { length: 20 })
    .$type<"round_robin" | "manual">()
    .default("round_robin")
    .notNull(),
  // Minutos para o corretor da vez receber antes de a roleta pular para o
  // próximo. Espelha o SLA de direcionamento já existente em leadSla.ts.
  assignmentTimeoutMinutes: integer("assignmentTimeoutMinutes")
    .default(15)
    .notNull(),
  // Minutos para atender após receber o lead antes de devolvê-lo à fila.
  attendanceTimeoutMinutes: integer("attendanceTimeoutMinutes")
    .default(40)
    .notNull(),
  // 1 = a roleta só roda em horário comercial (regra de leadSla.ts).
  businessHoursOnly: integer("businessHoursOnly").default(1).notNull(),
  // Minutos entre o webhook do BotConversa e a transferência da conversa
  // ao corretor no painel BotConversa. Dá tempo para o BotConversa coletar
  // respostas iniciais antes de acionar o corretor.
  botconversaDelayMinutes: integer("botconversaDelayMinutes")
    .default(4)
    .notNull(),
  createdByUserId: integer("createdByUserId").notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

export type AttendanceQueue = typeof attendanceQueues.$inferSelect;
export type InsertAttendanceQueue = typeof attendanceQueues.$inferInsert;

/**
 * Permissão de acesso de um corretor a uma fila. Quem tem `canJoin = 1` pode
 * entrar/sair da fila; o admin concede ou revoga. Uma linha por (fila, usuário).
 */
export const attendanceQueueMembers = pgTable(
  "attendanceQueueMembers",
  {
    id: serial("id").primaryKey(),
    queueId: integer("queueId").notNull(),
    userId: integer("userId").notNull(),
    canJoin: integer("canJoin").default(1).notNull(),
    createdByUserId: integer("createdByUserId"),
    createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
  },
  table => [
    uniqueIndex("attendanceQueueMembers_queueId_userId_idx").on(
      table.queueId,
      table.userId
    ),
  ]
);

export type AttendanceQueueMember = typeof attendanceQueueMembers.$inferSelect;
export type InsertAttendanceQueueMember =
  typeof attendanceQueueMembers.$inferInsert;

/**
 * Participação ativa de um corretor numa fila. `position` define a ordem do
 * rodízio (menor = mais perto de receber); ao receber um lead o corretor volta
 * para o fim (maior position). `isActive = 0` significa que ele saiu da fila mas
 * mantemos o histórico. Uma linha por (fila, usuário).
 */
export const attendanceQueueParticipants = pgTable(
  "attendanceQueueParticipants",
  {
    id: serial("id").primaryKey(),
    queueId: integer("queueId").notNull(),
    userId: integer("userId").notNull(),
    position: integer("position").default(0).notNull(),
    isActive: integer("isActive").default(1).notNull(),
    joinedAt: timestamp("joinedAt", { mode: "date" }).defaultNow().notNull(),
    leftAt: timestamp("leftAt", { mode: "date" }),
    lastAssignedAt: timestamp("lastAssignedAt", { mode: "date" }),
    updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
  },
  table => [
    uniqueIndex("attendanceQueueParticipants_queueId_userId_idx").on(
      table.queueId,
      table.userId
    ),
  ]
);

export type AttendanceQueueParticipant =
  typeof attendanceQueueParticipants.$inferSelect;
export type InsertAttendanceQueueParticipant =
  typeof attendanceQueueParticipants.$inferInsert;

/**
 * Imobiliária cliente da plataforma (tenant). Fase 1 opera com 1 tenant
 * ; fase 2 (multi-tenant) reutiliza esta tabela como raiz de escopo.
 */
export const tenants = pgTable("tenants", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  nome: varchar("nome", { length: 200 }).notNull(),
  cnpj: varchar("cnpj", { length: 18 }),
  creciPj: varchar("creciPj", { length: 32 }),
  email: varchar("email", { length: 320 }),
  telefone: varchar("telefone", { length: 20 }),
  cep: varchar("cep", { length: 10 }),
  endereco: varchar("endereco", { length: 255 }),
  numero: varchar("numero", { length: 20 }),
  complemento: varchar("complemento", { length: 120 }),
  bairro: varchar("bairro", { length: 100 }),
  cidade: varchar("cidade", { length: 100 }),
  estado: varchar("estado", { length: 2 }),
  /** 1 = ativo, 0 = inativado (soft-delete). Registros inativos ficam
   * ocultos por padrão na lista, aparecem só com filtro. */
  isActive: integer("isActive").default(1).notNull(),
  inactivatedAt: timestamp("inactivatedAt", { mode: "date" }),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = typeof tenants.$inferInsert;

/**
 * Licença mensal da imobiliária. Estados:
 *  - active: em dia (dueDate no futuro)
 *  - grace: vencida há <= gracePeriodDays (ainda pode operar)
 *  - readonly: vencida há > gracePeriodDays (sistema em leitura)
 *  - suspended: bloqueio manual pelo super-admin
 * Valor é armazenado em centavos (BRL).
 */
export const licenses = pgTable("licenses", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull().unique(),
  status: varchar("status", { length: 20 })
    .$type<"active" | "grace" | "readonly" | "suspended">()
    .default("active")
    .notNull(),
  valorCentavos: integer("valorCentavos").default(0).notNull(),
  dueDate: date("dueDate", { mode: "date" }).notNull(),
  gracePeriodDays: integer("gracePeriodDays").default(7).notNull(),
  lastPaidAt: timestamp("lastPaidAt", { mode: "date" }),
  notes: text("notes"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

export type License = typeof licenses.$inferSelect;
export type InsertLicense = typeof licenses.$inferInsert;

/**
 * Histórico de pagamentos/eventos da licença. Cada linha é uma "competência"
 * (mês/ciclo) marcada como paga; usado para relatório e para auditar
 * quem/quando renovou.
 */
/**
 * Parâmetros gerais do sistema (linha única). Guarda dados cadastrais
 * da imobiliária, do corretor responsável, dados bancários e regras
 * de comissão. Editado por administrativo via /admin/parametros.
 *
 * Percentuais são guardados em basis points (bps) — 500 = 5.00 %,
 * 1250 = 12.50 % — para evitar problemas de arredondamento float.
 */
export const systemParameters = pgTable("systemParameters", {
  id: serial("id").primaryKey(),
  // ── 1. Imobiliária ────────────────────────────────────────────────
  imobNomeFantasia: varchar("imobNomeFantasia", { length: 200 }),
  imobRazaoSocial: varchar("imobRazaoSocial", { length: 200 }),
  imobCnpj: varchar("imobCnpj", { length: 18 }),
  imobCreciPj: varchar("imobCreciPj", { length: 32 }),
  imobInscricaoEstadual: varchar("imobInscricaoEstadual", { length: 32 }),
  imobTelefone: varchar("imobTelefone", { length: 20 }),
  imobEmail: varchar("imobEmail", { length: 320 }),
  imobCep: varchar("imobCep", { length: 10 }),
  imobEndereco: varchar("imobEndereco", { length: 255 }),
  imobNumero: varchar("imobNumero", { length: 20 }),
  imobComplemento: varchar("imobComplemento", { length: 120 }),
  imobBairro: varchar("imobBairro", { length: 100 }),
  imobCidade: varchar("imobCidade", { length: 100 }),
  imobEstado: varchar("imobEstado", { length: 2 }),
  // ── 2. Corretor Responsável ───────────────────────────────────────
  respNome: varchar("respNome", { length: 200 }),
  respCpf: varchar("respCpf", { length: 14 }),
  respCreci: varchar("respCreci", { length: 32 }),
  respTelefone: varchar("respTelefone", { length: 20 }),
  respEmail: varchar("respEmail", { length: 320 }),
  // ── 3. Financeiras ────────────────────────────────────────────────
  bancoNome: varchar("bancoNome", { length: 100 }),
  bancoAgencia: varchar("bancoAgencia", { length: 20 }),
  bancoConta: varchar("bancoConta", { length: 30 }),
  bancoTipoConta: varchar("bancoTipoConta", { length: 10 }).$type<
    "corrente" | "poupanca"
  >(),
  bancoTitular: varchar("bancoTitular", { length: 200 }),
  bancoTitularDoc: varchar("bancoTitularDoc", { length: 18 }),
  pixTipo: varchar("pixTipo", { length: 12 }).$type<
    "cpf" | "cnpj" | "email" | "telefone" | "aleatoria"
  >(),
  pixChave: varchar("pixChave", { length: 100 }),
  // ── 4. Comissões e Pagamentos (percentuais em basis points) ───────
  comissaoVendaBps: integer("comissaoVendaBps").default(600).notNull(),
  comissaoLocacaoBps: integer("comissaoLocacaoBps").default(1000).notNull(),
  comissaoImobiliariaBps: integer("comissaoImobiliariaBps")
    .default(5000)
    .notNull(),
  comissaoCorretorBps: integer("comissaoCorretorBps").default(5000).notNull(),
  diaPagamentoCorretor: integer("diaPagamentoCorretor").default(10).notNull(),
  metodoPagamentoCorretor: varchar("metodoPagamentoCorretor", { length: 10 })
    .$type<"pix" | "ted" | "boleto">()
    .default("pix")
    .notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
  updatedByUserId: integer("updatedByUserId"),
});
export type SystemParameters = typeof systemParameters.$inferSelect;
export type InsertSystemParameters = typeof systemParameters.$inferInsert;

/**
 * Ativação da licença desta instalação (linha única).
 * A ativação inicial pede um `code` ao NOXILON Central e recebe de volta
 * um JWT (RS256) contendo tenantId/status/dueDate. Um scheduler faz
 * heartbeat periódico com o Central para renovar o token. Se a licença
 * expirar (ou o central for inalcançável por N horas), o sistema entra
 * em modo readonly (bloqueia mutations tRPC).
 */
export const licenseActivation = pgTable("licenseActivation", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  tenantSlug: varchar("tenantSlug", { length: 64 }).notNull(),
  tenantNome: varchar("tenantNome", { length: 200 }).notNull(),
  activationCodeId: integer("activationCodeId").notNull(),
  token: text("token").notNull(),
  licenseStatus: varchar("licenseStatus", { length: 20 })
    .$type<"active" | "grace" | "readonly" | "suspended">()
    .default("active")
    .notNull(),
  dueDate: date("dueDate", { mode: "date" }),
  tokenExpiresAt: timestamp("tokenExpiresAt", { mode: "date" }).notNull(),
  activatedAt: timestamp("activatedAt", { mode: "date" }).defaultNow().notNull(),
  lastHeartbeatAt: timestamp("lastHeartbeatAt", { mode: "date" }),
  lastHeartbeatError: text("lastHeartbeatError"),
  centralUrl: varchar("centralUrl", { length: 255 }).notNull(),
});
export type LicenseActivation = typeof licenseActivation.$inferSelect;
export type InsertLicenseActivation = typeof licenseActivation.$inferInsert;

export const licensePayments = pgTable("licensePayments", {
  id: serial("id").primaryKey(),
  licenseId: integer("licenseId").notNull(),
  tenantId: integer("tenantId").notNull(),
  valorCentavos: integer("valorCentavos").notNull(),
  paidAt: timestamp("paidAt", { mode: "date" }).notNull(),
  competenciaDe: date("competenciaDe", { mode: "date" }).notNull(),
  competenciaAte: date("competenciaAte", { mode: "date" }).notNull(),
  registradoPorUserId: integer("registradoPorUserId"),
  observacao: text("observacao"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

export type LicensePayment = typeof licensePayments.$inferSelect;
export type InsertLicensePayment = typeof licensePayments.$inferInsert;

/* ==========================================================================
 * LOJA & CARTEIRA (bonificações)
 * ========================================================================== */

export const walletBalances = pgTable("walletBalances", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().unique(),
  tokens: integer("tokens").default(0).notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

export type WalletBalance = typeof walletBalances.$inferSelect;
export type InsertWalletBalance = typeof walletBalances.$inferInsert;

export const walletTransactions = pgTable("walletTransactions", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  type: varchar("type", { length: 10 })
    .$type<"credit" | "debit">()
    .notNull(),
  amount: integer("amount").notNull(),
  reason: varchar("reason", { length: 40 }).notNull(),
  description: text("description"),
  referenceType: varchar("referenceType", { length: 40 }),
  referenceId: integer("referenceId"),
  createdByUserId: integer("createdByUserId"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

export type WalletTransaction = typeof walletTransactions.$inferSelect;
export type InsertWalletTransaction = typeof walletTransactions.$inferInsert;

export const storeSettings = pgTable("storeSettings", {
  id: serial("id").primaryKey(),
  pixKey: varchar("pixKey", { length: 100 }),
  pixMerchantName: varchar("pixMerchantName", { length: 60 }),
  pixMerchantCity: varchar("pixMerchantCity", { length: 40 }),
  tokensSalePercentMilli: integer("tokensSalePercentMilli").default(0).notNull(),
  tokensRentalPercentMilli: integer("tokensRentalPercentMilli").default(0).notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
  updatedByUserId: integer("updatedByUserId"),
});

export type StoreSettings = typeof storeSettings.$inferSelect;
export type InsertStoreSettings = typeof storeSettings.$inferInsert;

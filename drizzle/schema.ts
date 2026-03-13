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
  idCorretor: integer("idCorretor").notNull(), // ID do corretor responsavel
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

export type Property = typeof properties.$inferSelect;
export type InsertProperty = typeof properties.$inferInsert;

/**
 * Tabela de leads do CRM
 * Armazena informacoes sobre potenciais clientes
 */
export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  cpf: varchar("cpf", { length: 14 }),
  telefone: varchar("telefone", { length: 20 }),
  origem: varchar("origem", { length: 100 }), // site, whatsapp, indicacao, etc
  interesse: text("interesse"), // descricao do interesse
  observacao: text("observacao"), // observacoes sobre o lead
  status: varchar("status", { length: 50 }).default("novo").notNull(), // novo, atendimento, proposta, negociacao, fechado, perdidos
  userId: integer("userId"), // conta vinculada por CPF quando existir
  idResponsavel: integer("idResponsavel"), // ID do corretor/admin responsavel
  idImovel: integer("idImovel"), // ID do imovel de interesse (opcional)
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

import { date, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** OAuth identifier (openId) returned from the authentication provider. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  cpf: varchar("cpf", { length: 14 }).unique(),
  phone: varchar("phone", { length: 20 }),
  birthDate: date("birthDate"),
  profession: varchar("profession", { length: 120 }),
  grossMonthlyIncome: int("grossMonthlyIncome"),
  maritalStatus: varchar("maritalStatus", { length: 40 }),
  householdIncome: int("householdIncome"),
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
  role: mysqlEnum("role", ["cliente", "corretor", "administrativo"]).default("cliente").notNull(),
  isActive: int("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Tabela de imóveis
 * Armazena informações sobre os imóveis cadastrados no sistema
 */
export const properties = mysqlTable("properties", {
  id: int("id").autoincrement().primaryKey(),
  titulo: varchar("titulo", { length: 255 }).notNull(),
  descricao: text("descricao"),
  tipo: varchar("tipo", { length: 50 }).notNull(), // casa, apartamento, terreno, comercial
  finalidade: varchar("finalidade", { length: 20 }).notNull(), // venda, locacao, ambos
  valor: int("valor").notNull(), // valor em centavos
  valorLocacao: int("valorLocacao"), // valor de locação em centavos (se aplicável)
  area: int("area"), // área em m²
  quartos: int("quartos"),
  banheiros: int("banheiros"),
  vagas: int("vagas"),
  endereco: varchar("endereco", { length: 255 }).notNull(),
  numero: varchar("numero", { length: 20 }),
  bairro: varchar("bairro", { length: 100 }),
  cidade: varchar("cidade", { length: 100 }).notNull(),
  estado: varchar("estado", { length: 2 }).notNull(),
  cep: varchar("cep", { length: 10 }),
  latitude: varchar("latitude", { length: 20 }),
  longitude: varchar("longitude", { length: 20 }),
  fotos: text("fotos"), // JSON array de URLs das fotos
  destaque: int("destaque").default(0).notNull(), // 0 = não, 1 = sim
  status: varchar("status", { length: 20 }).default("ativo").notNull(), // ativo, vendido, alugado, inativo
  idCorretor: int("idCorretor").notNull(), // ID do corretor responsável
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Property = typeof properties.$inferSelect;
export type InsertProperty = typeof properties.$inferInsert;

/**
 * Tabela de leads do CRM
 * Armazena informações sobre potenciais clientes
 */
export const leads = mysqlTable("leads", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  telefone: varchar("telefone", { length: 20 }),
  origem: varchar("origem", { length: 100 }), // site, whatsapp, indicação, etc
  interesse: text("interesse"), // descrição do interesse
  observacao: text("observacao"), // observacoes sobre o lead
  status: varchar("status", { length: 50 }).default("novo").notNull(), // novo, atendimento, proposta, negociacao, fechado, perdidos
  idResponsavel: int("idResponsavel"), // ID do corretor/admin responsável
  idImovel: int("idImovel"), // ID do imóvel de interesse (opcional)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;

/**
 * Tabela de anotações de leads
 * Armazena o histórico de interações com cada lead
 */
export const leadNotes = mysqlTable("leadNotes", {
  id: int("id").autoincrement().primaryKey(),
  idLead: int("idLead").notNull(),
  idUsuario: int("idUsuario").notNull(), // quem fez a anotação
  anotacao: text("anotacao").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LeadNote = typeof leadNotes.$inferSelect;
export type InsertLeadNote = typeof leadNotes.$inferInsert;

/**
 * Tabela de arquivos de leads
 * Armazena documentos e arquivos relacionados aos leads
 */
export const leadFiles = mysqlTable("leadFiles", {
  id: int("id").autoincrement().primaryKey(),
  idLead: int("idLead").notNull(),
  idUsuario: int("idUsuario").notNull(), // quem fez o upload
  nomeArquivo: varchar("nomeArquivo", { length: 255 }).notNull(),
  urlArquivo: varchar("urlArquivo", { length: 500 }).notNull(),
  tipoArquivo: varchar("tipoArquivo", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LeadFile = typeof leadFiles.$inferSelect;
export type InsertLeadFile = typeof leadFiles.$inferInsert;

/**
 * Tabela de contratos
 * Armazena informações sobre contratos de clientes
 */
export const contracts = mysqlTable("contracts", {
  id: int("id").autoincrement().primaryKey(),
  idCliente: int("idCliente").notNull(),
  idImovel: int("idImovel").notNull(),
  tipo: varchar("tipo", { length: 20 }).notNull(), // venda, locacao
  valor: int("valor").notNull(), // valor em centavos
  dataInicio: timestamp("dataInicio").notNull(),
  dataFim: timestamp("dataFim"),
  status: varchar("status", { length: 20 }).default("ativo").notNull(), // ativo, encerrado, cancelado
  urlContrato: varchar("urlContrato", { length: 500 }), // URL do PDF do contrato
  observacoes: text("observacoes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Contract = typeof contracts.$inferSelect;
export type InsertContract = typeof contracts.$inferInsert;

/**
 * Tabela de documentos de clientes
 * Armazena documentos enviados pelos clientes
 */
export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
  idUsuario: int("idUsuario").notNull(),
  nomeArquivo: varchar("nomeArquivo", { length: 255 }).notNull(),
  urlArquivo: varchar("urlArquivo", { length: 500 }).notNull(),
  tipo: varchar("tipo", { length: 100 }).notNull(), // rg, cpf, comprovante_residencia, etc
  status: varchar("status", { length: 20 }).default("pendente").notNull(), // pendente, aprovado, rejeitado
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

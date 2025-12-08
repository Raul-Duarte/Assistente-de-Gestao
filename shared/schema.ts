import { sql, relations } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// User profiles/roles table
export const profiles = pgTable("profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  permissions: jsonb("permissions").$type<string[]>().default([]),
  isSystem: boolean("is_system").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Subscription plans table
export const plans = pgTable("plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 50 }).notNull().unique(),
  description: text("description"),
  price: integer("price").default(0),
  features: jsonb("features").$type<string[]>().default([]),
  tools: jsonb("tools").$type<string[]>().default([]),
  maxArtifactsPerMonth: integer("max_artifacts_per_month").default(10),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Users table with Replit Auth integration
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  profileId: varchar("profile_id").references(() => profiles.id),
  planId: varchar("plan_id").references(() => plans.id),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Templates table for storing document templates
export const templates = pgTable("templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  description: varchar("description", { length: 255 }).notNull(),
  type: varchar("type", { length: 20 }).notNull(), // 'text' or 'file'
  content: text("content"), // For text templates
  fileName: varchar("file_name", { length: 255 }), // For file templates
  fileData: text("file_data"), // Base64 encoded file content
  mimeType: varchar("mime_type", { length: 100 }),
  fileSize: integer("file_size"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Artifact types table for dynamic artifact type management
export const artifactTypes = pgTable("artifact_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: varchar("slug", { length: 50 }).notNull().unique(),
  title: varchar("title", { length: 100 }).notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Artifacts table for storing generated documents
export const artifacts = pgTable("artifacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  transcription: text("transcription"),
  templateId: varchar("template_id").references(() => templates.id),
  status: varchar("status", { length: 20 }).default("completed"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [users.profileId],
    references: [profiles.id],
  }),
  plan: one(plans, {
    fields: [users.planId],
    references: [plans.id],
  }),
  artifacts: many(artifacts),
  templates: many(templates),
}));

export const profilesRelations = relations(profiles, ({ many }) => ({
  users: many(users),
}));

export const plansRelations = relations(plans, ({ many }) => ({
  users: many(users),
}));

export const artifactTypesRelations = relations(artifactTypes, ({ many }) => ({
  artifacts: many(artifacts),
}));

export const artifactsRelations = relations(artifacts, ({ one }) => ({
  user: one(users, {
    fields: [artifacts.userId],
    references: [users.id],
  }),
  template: one(templates, {
    fields: [artifacts.templateId],
    references: [templates.id],
  }),
}));

export const templatesRelations = relations(templates, ({ one, many }) => ({
  user: one(users, {
    fields: [templates.userId],
    references: [users.id],
  }),
  artifacts: many(artifacts),
}));

// Insert schemas
export const insertProfileSchema = createInsertSchema(profiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPlanSchema = createInsertSchema(plans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertArtifactSchema = createInsertSchema(artifacts).omit({
  id: true,
  createdAt: true,
});

export const insertTemplateSchema = createInsertSchema(templates).omit({
  id: true,
  createdAt: true,
});

export const insertArtifactTypeSchema = createInsertSchema(artifactTypes).omit({
  id: true,
  createdAt: true,
});

// Schema for manual user creation by admin
export const createManualUserSchema = z.object({
  email: z.string().email("Email inválido"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  profileId: z.string().optional(),
  planId: z.string().optional(),
});

// Types
export type Profile = typeof profiles.$inferSelect;
export type InsertProfile = z.infer<typeof insertProfileSchema>;

export type Plan = typeof plans.$inferSelect;
export type InsertPlan = z.infer<typeof insertPlanSchema>;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpsertUser = typeof users.$inferInsert;

export type Artifact = typeof artifacts.$inferSelect;
export type InsertArtifact = z.infer<typeof insertArtifactSchema>;

export type Template = typeof templates.$inferSelect;
export type InsertTemplate = z.infer<typeof insertTemplateSchema>;

export type ArtifactTypeRecord = typeof artifactTypes.$inferSelect;
export type InsertArtifactType = z.infer<typeof insertArtifactTypeSchema>;

// ==========================================
// CLIENTS MODULE - Gestão de Clientes
// ==========================================

// Clients table (separate from system users)
export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  cpf: varchar("cpf", { length: 14 }).notNull().unique(),
  address: text("address"),
  status: varchar("status", { length: 20 }).default("ativo").notNull(), // ativo, inadimplente
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Subscriptions table (Client <-> Plan relationship)
export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => clients.id).notNull(),
  planId: varchar("plan_id").references(() => plans.id).notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  status: varchar("status", { length: 20 }).default("ativa").notNull(), // ativa, cancelada, suspensa
  billingDay: integer("billing_day").default(1), // Day of month for billing
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Invoices/Mensalidades table
export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subscriptionId: varchar("subscription_id").references(() => subscriptions.id).notNull(),
  clientId: varchar("client_id").references(() => clients.id).notNull(),
  amount: integer("amount").notNull(), // in cents
  dueDate: timestamp("due_date").notNull(),
  status: varchar("status", { length: 20 }).default("pendente").notNull(), // pendente, paga, atrasada
  referenceMonth: varchar("reference_month", { length: 7 }).notNull(), // YYYY-MM format
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Payments table
export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").references(() => invoices.id).notNull(),
  clientId: varchar("client_id").references(() => clients.id).notNull(),
  amount: integer("amount").notNull(), // in cents
  paymentDate: timestamp("payment_date").defaultNow(),
  paymentMethod: varchar("payment_method", { length: 50 }), // pix, boleto, cartao, manual
  transactionId: varchar("transaction_id", { length: 255 }), // Gateway transaction ID
  status: varchar("status", { length: 20 }).default("aprovado").notNull(), // aprovado, pendente, recusado
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ==========================================
// RELATIONS FOR NEW TABLES
// ==========================================

export const clientsRelations = relations(clients, ({ many }) => ({
  subscriptions: many(subscriptions),
  invoices: many(invoices),
  payments: many(payments),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
  client: one(clients, {
    fields: [subscriptions.clientId],
    references: [clients.id],
  }),
  plan: one(plans, {
    fields: [subscriptions.planId],
    references: [plans.id],
  }),
  invoices: many(invoices),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  subscription: one(subscriptions, {
    fields: [invoices.subscriptionId],
    references: [subscriptions.id],
  }),
  client: one(clients, {
    fields: [invoices.clientId],
    references: [clients.id],
  }),
  payments: many(payments),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  invoice: one(invoices, {
    fields: [payments.invoiceId],
    references: [invoices.id],
  }),
  client: one(clients, {
    fields: [payments.clientId],
    references: [clients.id],
  }),
}));

// ==========================================
// INSERT SCHEMAS FOR NEW TABLES
// ==========================================

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
});

// ==========================================
// TYPES FOR NEW TABLES
// ==========================================

export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;

// ==========================================
// CLIENT STATUS ENUM
// ==========================================

export const CLIENT_STATUS = {
  ATIVO: "ativo",
  INADIMPLENTE: "inadimplente",
} as const;

export const SUBSCRIPTION_STATUS = {
  ATIVA: "ativa",
  CANCELADA: "cancelada",
  SUSPENSA: "suspensa",
} as const;

export const INVOICE_STATUS = {
  PENDENTE: "pendente",
  PAGA: "paga",
  ATRASADA: "atrasada",
} as const;

export const PAYMENT_STATUS = {
  APROVADO: "aprovado",
  PENDENTE: "pendente",
  RECUSADO: "recusado",
} as const;

// Artifact types enum (legacy - will be replaced by database types)
export const ARTIFACT_TYPES = {
  BUSINESS_RULES: "business_rules",
  ACTION_POINTS: "action_points",
  REFERRALS: "referrals",
  CRITICAL_POINTS: "critical_points",
} as const;

export type ArtifactType = (typeof ARTIFACT_TYPES)[keyof typeof ARTIFACT_TYPES];

// Artifact type labels in Portuguese
export const ARTIFACT_TYPE_LABELS: Record<ArtifactType, string> = {
  [ARTIFACT_TYPES.BUSINESS_RULES]: "Regras de Negócio",
  [ARTIFACT_TYPES.ACTION_POINTS]: "Pontos de Ação",
  [ARTIFACT_TYPES.REFERRALS]: "Encaminhamentos",
  [ARTIFACT_TYPES.CRITICAL_POINTS]: "Pontos Críticos",
};

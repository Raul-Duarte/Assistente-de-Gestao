import {
  users,
  profiles,
  plans,
  artifacts,
  templates,
  artifactTypes,
  clients,
  subscriptions,
  invoices,
  payments,
  type User,
  type UpsertUser,
  type Profile,
  type InsertProfile,
  type Plan,
  type InsertPlan,
  type Artifact,
  type InsertArtifact,
  type Template,
  type InsertTemplate,
  type ArtifactTypeRecord,
  type InsertArtifactType,
  type Client,
  type InsertClient,
  type Subscription,
  type InsertSubscription,
  type Invoice,
  type InsertInvoice,
  type Payment,
  type InsertPayment,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, lt, sql } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  createManualUser(data: { email: string; firstName?: string; lastName?: string; profileId?: string; planId?: string }): Promise<User>;
  getAllUsers(): Promise<(User & { profile?: Profile; plan?: Plan })[]>;
  updateUser(id: string, data: Partial<UpsertUser>): Promise<User>;
  getUserPlan(userId: string): Promise<Plan | undefined>;
  getUserProfile(userId: string): Promise<Profile | undefined>;

  // Profile operations
  getProfiles(): Promise<Profile[]>;
  getProfile(id: string): Promise<Profile | undefined>;
  createProfile(data: InsertProfile): Promise<Profile>;
  updateProfile(id: string, data: Partial<InsertProfile>): Promise<Profile>;
  deleteProfile(id: string): Promise<void>;

  // Plan operations
  getPlans(): Promise<Plan[]>;
  getPlan(id: string): Promise<Plan | undefined>;
  getPlanBySlug(slug: string): Promise<Plan | undefined>;
  createPlan(data: InsertPlan): Promise<Plan>;
  updatePlan(id: string, data: Partial<InsertPlan>): Promise<Plan>;
  deletePlan(id: string): Promise<void>;

  // Artifact operations
  getArtifacts(userId: string): Promise<Artifact[]>;
  getAllArtifacts(): Promise<(Artifact & { user?: User })[]>;
  getArtifact(id: string): Promise<Artifact | undefined>;
  createArtifact(data: InsertArtifact): Promise<Artifact>;
  deleteArtifact(id: string): Promise<void>;

  // Template operations
  getTemplates(userId: string): Promise<Template[]>;
  getTemplate(id: string): Promise<Template | undefined>;
  createTemplate(data: InsertTemplate): Promise<Template>;
  deleteTemplate(id: string): Promise<void>;

  // Artifact type operations
  getArtifactTypes(): Promise<ArtifactTypeRecord[]>;
  getArtifactType(id: string): Promise<ArtifactTypeRecord | undefined>;
  getArtifactTypeBySlug(slug: string): Promise<ArtifactTypeRecord | undefined>;
  createArtifactType(data: InsertArtifactType): Promise<ArtifactTypeRecord>;
  updateArtifactType(id: string, data: Partial<InsertArtifactType>): Promise<ArtifactTypeRecord>;
  deleteArtifactType(id: string): Promise<void>;

  // Client operations
  getClients(): Promise<Client[]>;
  getClient(id: string): Promise<Client | undefined>;
  getClientByCpf(cpf: string): Promise<Client | undefined>;
  getClientByEmail(email: string): Promise<Client | undefined>;
  getClientByUserId(userId: string): Promise<Client | undefined>;
  getClientByEmailToken(token: string): Promise<Client | undefined>;
  createClient(data: InsertClient): Promise<Client>;
  updateClient(id: string, data: Partial<Client>): Promise<Client>;
  deleteClient(id: string): Promise<void>;
  updateClientStatus(id: string, status: string): Promise<Client>;

  // Subscription operations
  getSubscriptions(): Promise<(Subscription & { client?: Client; plan?: Plan })[]>;
  getSubscription(id: string): Promise<Subscription | undefined>;
  getClientSubscriptions(clientId: string): Promise<(Subscription & { plan?: Plan })[]>;
  createSubscription(data: InsertSubscription): Promise<Subscription>;
  updateSubscription(id: string, data: Partial<InsertSubscription>): Promise<Subscription>;
  cancelSubscription(id: string): Promise<Subscription>;
  activateSubscription(id: string): Promise<Subscription>;

  // Invoice operations
  getInvoices(): Promise<(Invoice & { client?: Client; subscription?: Subscription })[]>;
  getInvoice(id: string): Promise<Invoice | undefined>;
  getClientInvoices(clientId: string): Promise<Invoice[]>;
  getSubscriptionInvoices(subscriptionId: string): Promise<Invoice[]>;
  createInvoice(data: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: string, data: Partial<InsertInvoice>): Promise<Invoice>;
  updateInvoiceStatus(id: string, status: string): Promise<Invoice>;
  getOverdueInvoices(): Promise<Invoice[]>;

  // Payment operations
  getPayments(): Promise<(Payment & { client?: Client; invoice?: Invoice })[]>;
  getPayment(id: string): Promise<Payment | undefined>;
  getClientPayments(clientId: string): Promise<Payment[]>;
  getInvoicePayments(invoiceId: string): Promise<Payment[]>;
  createPayment(data: InsertPayment): Promise<Payment>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createManualUser(data: { email: string; firstName?: string; lastName?: string; profileId?: string; planId?: string }): Promise<User> {
    const id = `manual_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const [user] = await db
      .insert(users)
      .values({
        id,
        email: data.email,
        firstName: data.firstName || null,
        lastName: data.lastName || null,
        profileId: data.profileId || null,
        planId: data.planId || null,
        isActive: true,
      })
      .returning();
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getAllUsers(): Promise<(User & { profile?: Profile; plan?: Plan })[]> {
    const result = await db
      .select()
      .from(users)
      .leftJoin(profiles, eq(users.profileId, profiles.id))
      .leftJoin(plans, eq(users.planId, plans.id))
      .orderBy(desc(users.createdAt));

    return result.map((row) => ({
      ...row.users,
      profile: row.profiles || undefined,
      plan: row.plans || undefined,
    }));
  }

  async updateUser(id: string, data: Partial<UpsertUser>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async getUserPlan(userId: string): Promise<Plan | undefined> {
    const user = await this.getUser(userId);
    if (!user?.planId) {
      // Return default free plan
      const freePlan = await this.getPlanBySlug("free");
      return freePlan;
    }
    return this.getPlan(user.planId);
  }

  async getUserProfile(userId: string): Promise<Profile | undefined> {
    const user = await this.getUser(userId);
    if (!user?.profileId) {
      // Return default client profile
      const [clientProfile] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.name, "Cliente"));
      return clientProfile;
    }
    return this.getProfile(user.profileId);
  }

  // Profile operations
  async getProfiles(): Promise<Profile[]> {
    return db.select().from(profiles).orderBy(profiles.name);
  }

  async getProfile(id: string): Promise<Profile | undefined> {
    const [profile] = await db.select().from(profiles).where(eq(profiles.id, id));
    return profile;
  }

  async createProfile(data: InsertProfile): Promise<Profile> {
    const [profile] = await db.insert(profiles).values(data).returning();
    return profile;
  }

  async updateProfile(id: string, data: Partial<InsertProfile>): Promise<Profile> {
    const [profile] = await db
      .update(profiles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(profiles.id, id))
      .returning();
    return profile;
  }

  async deleteProfile(id: string): Promise<void> {
    await db.delete(profiles).where(eq(profiles.id, id));
  }

  // Plan operations
  async getPlans(): Promise<Plan[]> {
    return db.select().from(plans).orderBy(plans.price);
  }

  async getPlan(id: string): Promise<Plan | undefined> {
    const [plan] = await db.select().from(plans).where(eq(plans.id, id));
    return plan;
  }

  async getPlanBySlug(slug: string): Promise<Plan | undefined> {
    const [plan] = await db.select().from(plans).where(eq(plans.slug, slug));
    return plan;
  }

  async createPlan(data: InsertPlan): Promise<Plan> {
    const [plan] = await db.insert(plans).values(data).returning();
    return plan;
  }

  async updatePlan(id: string, data: Partial<InsertPlan>): Promise<Plan> {
    const [plan] = await db
      .update(plans)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(plans.id, id))
      .returning();
    return plan;
  }

  async deletePlan(id: string): Promise<void> {
    await db.delete(plans).where(eq(plans.id, id));
  }

  // Artifact operations
  async getArtifacts(userId: string): Promise<Artifact[]> {
    return db
      .select()
      .from(artifacts)
      .where(eq(artifacts.userId, userId))
      .orderBy(desc(artifacts.createdAt));
  }

  async getAllArtifacts(): Promise<(Artifact & { user?: User })[]> {
    const result = await db
      .select()
      .from(artifacts)
      .leftJoin(users, eq(artifacts.userId, users.id))
      .orderBy(desc(artifacts.createdAt));

    return result.map((row) => ({
      ...row.artifacts,
      user: row.users || undefined,
    }));
  }

  async getArtifact(id: string): Promise<Artifact | undefined> {
    const [artifact] = await db.select().from(artifacts).where(eq(artifacts.id, id));
    return artifact;
  }

  async createArtifact(data: InsertArtifact): Promise<Artifact> {
    const [artifact] = await db.insert(artifacts).values(data).returning();
    return artifact;
  }

  async deleteArtifact(id: string): Promise<void> {
    await db.delete(artifacts).where(eq(artifacts.id, id));
  }

  // Template operations
  async getTemplates(userId: string): Promise<Template[]> {
    return db
      .select()
      .from(templates)
      .where(eq(templates.userId, userId))
      .orderBy(desc(templates.createdAt));
  }

  async getTemplate(id: string): Promise<Template | undefined> {
    const [template] = await db.select().from(templates).where(eq(templates.id, id));
    return template;
  }

  async createTemplate(data: InsertTemplate): Promise<Template> {
    const [template] = await db.insert(templates).values(data).returning();
    return template;
  }

  async deleteTemplate(id: string): Promise<void> {
    await db.delete(templates).where(eq(templates.id, id));
  }

  // Artifact type operations
  async getArtifactTypes(): Promise<ArtifactTypeRecord[]> {
    return db.select().from(artifactTypes).orderBy(artifactTypes.title);
  }

  async getArtifactType(id: string): Promise<ArtifactTypeRecord | undefined> {
    const [type] = await db.select().from(artifactTypes).where(eq(artifactTypes.id, id));
    return type;
  }

  async getArtifactTypeBySlug(slug: string): Promise<ArtifactTypeRecord | undefined> {
    const [type] = await db.select().from(artifactTypes).where(eq(artifactTypes.slug, slug));
    return type;
  }

  async createArtifactType(data: InsertArtifactType): Promise<ArtifactTypeRecord> {
    const [type] = await db.insert(artifactTypes).values(data).returning();
    return type;
  }

  async updateArtifactType(id: string, data: Partial<InsertArtifactType>): Promise<ArtifactTypeRecord> {
    const [type] = await db
      .update(artifactTypes)
      .set(data)
      .where(eq(artifactTypes.id, id))
      .returning();
    return type;
  }

  async deleteArtifactType(id: string): Promise<void> {
    await db.delete(artifactTypes).where(eq(artifactTypes.id, id));
  }

  // ==========================================
  // CLIENT OPERATIONS
  // ==========================================

  async getClients(): Promise<Client[]> {
    return db.select().from(clients).orderBy(clients.name);
  }

  async getClient(id: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client;
  }

  async getClientByCpf(cpf: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.cpf, cpf));
    return client;
  }

  async getClientByEmail(email: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.email, email));
    return client;
  }

  async getClientByUserId(userId: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.userId, userId));
    return client;
  }

  async getClientByEmailToken(token: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.emailVerificationToken, token));
    return client;
  }

  async createClient(data: InsertClient): Promise<Client> {
    const [client] = await db.insert(clients).values({
      ...data,
      status: "ativo",
    }).returning();
    return client;
  }

  async updateClient(id: string, data: Partial<Client>): Promise<Client> {
    const [client] = await db
      .update(clients)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(clients.id, id))
      .returning();
    return client;
  }

  async deleteClient(id: string): Promise<void> {
    await db.delete(clients).where(eq(clients.id, id));
  }

  async updateClientStatus(id: string, status: string): Promise<Client> {
    const [client] = await db
      .update(clients)
      .set({ status, updatedAt: new Date() })
      .where(eq(clients.id, id))
      .returning();
    return client;
  }

  // ==========================================
  // SUBSCRIPTION OPERATIONS
  // ==========================================

  async getSubscriptions(): Promise<(Subscription & { client?: Client; plan?: Plan })[]> {
    const result = await db
      .select()
      .from(subscriptions)
      .leftJoin(clients, eq(subscriptions.clientId, clients.id))
      .leftJoin(plans, eq(subscriptions.planId, plans.id))
      .orderBy(desc(subscriptions.createdAt));

    return result.map((row) => ({
      ...row.subscriptions,
      client: row.clients || undefined,
      plan: row.plans || undefined,
    }));
  }

  async getSubscription(id: string): Promise<Subscription | undefined> {
    const [subscription] = await db.select().from(subscriptions).where(eq(subscriptions.id, id));
    return subscription;
  }

  async getClientSubscriptions(clientId: string): Promise<(Subscription & { plan?: Plan })[]> {
    const result = await db
      .select()
      .from(subscriptions)
      .leftJoin(plans, eq(subscriptions.planId, plans.id))
      .where(eq(subscriptions.clientId, clientId))
      .orderBy(desc(subscriptions.createdAt));

    return result.map((row) => ({
      ...row.subscriptions,
      plan: row.plans || undefined,
    }));
  }

  async createSubscription(data: InsertSubscription): Promise<Subscription> {
    const [subscription] = await db.insert(subscriptions).values({
      ...data,
      status: "ativa",
    }).returning();
    return subscription;
  }

  async updateSubscription(id: string, data: Partial<InsertSubscription>): Promise<Subscription> {
    const [subscription] = await db
      .update(subscriptions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(subscriptions.id, id))
      .returning();
    return subscription;
  }

  async cancelSubscription(id: string): Promise<Subscription> {
    const [subscription] = await db
      .update(subscriptions)
      .set({ status: "cancelada", updatedAt: new Date() })
      .where(eq(subscriptions.id, id))
      .returning();
    return subscription;
  }

  async activateSubscription(id: string): Promise<Subscription> {
    const [subscription] = await db
      .update(subscriptions)
      .set({ status: "ativa", updatedAt: new Date() })
      .where(eq(subscriptions.id, id))
      .returning();
    return subscription;
  }

  // ==========================================
  // INVOICE OPERATIONS
  // ==========================================

  async getInvoices(): Promise<(Invoice & { client?: Client; subscription?: Subscription })[]> {
    const result = await db
      .select()
      .from(invoices)
      .leftJoin(clients, eq(invoices.clientId, clients.id))
      .leftJoin(subscriptions, eq(invoices.subscriptionId, subscriptions.id))
      .orderBy(desc(invoices.dueDate));

    return result.map((row) => ({
      ...row.invoices,
      client: row.clients || undefined,
      subscription: row.subscriptions || undefined,
    }));
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    return invoice;
  }

  async getClientInvoices(clientId: string): Promise<Invoice[]> {
    return db
      .select()
      .from(invoices)
      .where(eq(invoices.clientId, clientId))
      .orderBy(desc(invoices.dueDate));
  }

  async getSubscriptionInvoices(subscriptionId: string): Promise<Invoice[]> {
    return db
      .select()
      .from(invoices)
      .where(eq(invoices.subscriptionId, subscriptionId))
      .orderBy(desc(invoices.dueDate));
  }

  async createInvoice(data: InsertInvoice): Promise<Invoice> {
    const [invoice] = await db.insert(invoices).values(data).returning();
    return invoice;
  }

  async updateInvoice(id: string, data: Partial<InsertInvoice>): Promise<Invoice> {
    const [invoice] = await db
      .update(invoices)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(invoices.id, id))
      .returning();
    return invoice;
  }

  async updateInvoiceStatus(id: string, status: string): Promise<Invoice> {
    const [invoice] = await db
      .update(invoices)
      .set({ status, updatedAt: new Date() })
      .where(eq(invoices.id, id))
      .returning();
    return invoice;
  }

  async getOverdueInvoices(): Promise<Invoice[]> {
    const now = new Date();
    return db
      .select()
      .from(invoices)
      .where(and(
        eq(invoices.status, "pendente"),
        lt(invoices.dueDate, now)
      ));
  }

  // ==========================================
  // PAYMENT OPERATIONS
  // ==========================================

  async getPayments(): Promise<(Payment & { client?: Client; invoice?: Invoice })[]> {
    const result = await db
      .select()
      .from(payments)
      .leftJoin(clients, eq(payments.clientId, clients.id))
      .leftJoin(invoices, eq(payments.invoiceId, invoices.id))
      .orderBy(desc(payments.paymentDate));

    return result.map((row) => ({
      ...row.payments,
      client: row.clients || undefined,
      invoice: row.invoices || undefined,
    }));
  }

  async getPayment(id: string): Promise<Payment | undefined> {
    const [payment] = await db.select().from(payments).where(eq(payments.id, id));
    return payment;
  }

  async getClientPayments(clientId: string): Promise<Payment[]> {
    return db
      .select()
      .from(payments)
      .where(eq(payments.clientId, clientId))
      .orderBy(desc(payments.paymentDate));
  }

  async getInvoicePayments(invoiceId: string): Promise<Payment[]> {
    return db
      .select()
      .from(payments)
      .where(eq(payments.invoiceId, invoiceId))
      .orderBy(desc(payments.paymentDate));
  }

  async createPayment(data: InsertPayment): Promise<Payment> {
    const [payment] = await db.insert(payments).values({
      ...data,
      status: "aprovado",
    }).returning();
    return payment;
  }
}

export const storage = new DatabaseStorage();

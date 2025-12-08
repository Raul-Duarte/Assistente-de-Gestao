import {
  users,
  profiles,
  plans,
  artifacts,
  templates,
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
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";

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

  // Artifact operations
  getArtifacts(userId: string): Promise<Artifact[]>;
  getAllArtifacts(): Promise<(Artifact & { user?: User })[]>;
  getArtifact(id: string): Promise<Artifact | undefined>;
  createArtifact(data: InsertArtifact): Promise<Artifact>;

  // Template operations
  getTemplates(userId: string): Promise<Template[]>;
  getTemplate(id: string): Promise<Template | undefined>;
  createTemplate(data: InsertTemplate): Promise<Template>;
  deleteTemplate(id: string): Promise<void>;
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
}

export const storage = new DatabaseStorage();

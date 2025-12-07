import { db } from "./db";
import { profiles, plans } from "@shared/schema";
import { ARTIFACT_TYPES } from "@shared/schema";

export async function seedDatabase() {
  console.log("Seeding database...");

  // Check if profiles exist
  const existingProfiles = await db.select().from(profiles);
  if (existingProfiles.length === 0) {
    console.log("Creating default profiles...");
    await db.insert(profiles).values([
      {
        name: "Administrador",
        description: "Acesso completo ao sistema, incluindo gerenciamento de usuários, perfis e planos.",
        permissions: [
          "users.view",
          "users.edit",
          "users.delete",
          "profiles.view",
          "profiles.edit",
          "plans.view",
          "plans.edit",
          "artifacts.generate",
          "artifacts.export",
        ],
        isSystem: true,
      },
      {
        name: "Cliente",
        description: "Acesso às ferramentas de acordo com o plano de assinatura.",
        permissions: ["artifacts.generate", "artifacts.export"],
        isSystem: true,
      },
    ]);
  }

  // Check if plans exist
  const existingPlans = await db.select().from(plans);
  if (existingPlans.length === 0) {
    console.log("Creating default plans...");
    await db.insert(plans).values([
      {
        name: "Free",
        slug: "free",
        description: "Ideal para experimentar a plataforma",
        price: 0,
        maxArtifactsPerMonth: 10,
        tools: [ARTIFACT_TYPES.BUSINESS_RULES],
        features: ["Suporte por Email"],
        isActive: true,
      },
      {
        name: "Plus",
        slug: "plus",
        description: "Perfeito para pequenas equipes",
        price: 4900,
        maxArtifactsPerMonth: 100,
        tools: [
          ARTIFACT_TYPES.BUSINESS_RULES,
          ARTIFACT_TYPES.ACTION_POINTS,
          ARTIFACT_TYPES.REFERRALS,
        ],
        features: ["Suporte Prioritário", "Exportação PDF"],
        isActive: true,
      },
      {
        name: "Premium",
        slug: "premium",
        description: "Para empresas que precisam de tudo",
        price: 14900,
        maxArtifactsPerMonth: 0, // unlimited
        tools: [
          ARTIFACT_TYPES.BUSINESS_RULES,
          ARTIFACT_TYPES.ACTION_POINTS,
          ARTIFACT_TYPES.REFERRALS,
          ARTIFACT_TYPES.CRITICAL_POINTS,
        ],
        features: [
          "Suporte 24/7",
          "Exportação PDF",
          "API de Integração",
          "Relatórios Avançados",
        ],
        isActive: true,
      },
    ]);
  }

  console.log("Database seeding complete!");
}

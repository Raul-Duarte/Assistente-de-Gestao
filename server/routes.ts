import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { generateArtifactContent } from "./openai";
import { insertProfileSchema, insertPlanSchema, ARTIFACT_TYPES, ARTIFACT_TYPE_LABELS, type ArtifactType } from "@shared/schema";
import { z } from "zod";
import PDFDocument from "pdfkit";

export async function registerRoutes(app: Express): Promise<Server> {
  await setupAuth(app);

  // Auth routes
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // User plan and profile
  app.get("/api/user/plan", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const plan = await storage.getUserPlan(userId);
      res.json(plan);
    } catch (error) {
      console.error("Error fetching user plan:", error);
      res.status(500).json({ message: "Failed to fetch plan" });
    }
  });

  app.get("/api/user/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getUserProfile(userId);
      res.json(profile);
    } catch (error) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  // Artifacts routes
  app.get("/api/artifacts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const artifacts = await storage.getArtifacts(userId);
      res.json(artifacts);
    } catch (error) {
      console.error("Error fetching artifacts:", error);
      res.status(500).json({ message: "Failed to fetch artifacts" });
    }
  });

  const generateArtifactsSchema = z.object({
    types: z.array(z.enum([
      ARTIFACT_TYPES.BUSINESS_RULES,
      ARTIFACT_TYPES.ACTION_POINTS,
      ARTIFACT_TYPES.REFERRALS,
      ARTIFACT_TYPES.CRITICAL_POINTS,
    ])),
    transcription: z.string().min(10, "Transcrição muito curta"),
  });

  app.post("/api/artifacts/generate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { types, transcription } = generateArtifactsSchema.parse(req.body);

      // Check user plan access
      const plan = await storage.getUserPlan(userId);
      const allowedTools = plan?.tools || [ARTIFACT_TYPES.BUSINESS_RULES];

      // Filter types based on plan
      const accessibleTypes = types.filter((type) => allowedTools.includes(type));

      if (accessibleTypes.length === 0) {
        return res.status(403).json({
          message: "Seu plano não permite acesso a essas ferramentas. Faça upgrade para desbloquear.",
        });
      }

      const generatedArtifacts = [];

      for (const type of accessibleTypes) {
        const content = await generateArtifactContent(type as ArtifactType, transcription);
        const title = `${ARTIFACT_TYPE_LABELS[type as ArtifactType]} - ${new Date().toLocaleDateString("pt-BR")}`;

        const artifact = await storage.createArtifact({
          userId,
          type,
          title,
          content,
          transcription,
          status: "completed",
        });

        generatedArtifacts.push(artifact);
      }

      res.json(generatedArtifacts);
    } catch (error: any) {
      console.error("Error generating artifacts:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: error.message || "Failed to generate artifacts" });
    }
  });

  app.get("/api/artifacts/:id/pdf", isAuthenticated, async (req: any, res) => {
    try {
      const artifact = await storage.getArtifact(req.params.id);

      if (!artifact) {
        return res.status(404).json({ message: "Artefato não encontrado" });
      }

      // Check if user owns the artifact
      const userId = req.user.claims.sub;
      if (artifact.userId !== userId) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      // Generate PDF
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => {
        const pdfBuffer = Buffer.concat(chunks);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${artifact.title}.pdf"`);
        res.send(pdfBuffer);
      });

      // PDF content
      doc.fontSize(24).font("Helvetica-Bold").text(artifact.title, { align: "center" });
      doc.moveDown();
      
      doc.fontSize(10).font("Helvetica").fillColor("#666666")
        .text(`Gerado em: ${new Date(artifact.createdAt!).toLocaleString("pt-BR")}`, { align: "center" });
      doc.moveDown(2);

      // Convert markdown-like content to simple text
      const content = artifact.content
        .replace(/^### (.+)$/gm, "\n$1\n")
        .replace(/^## (.+)$/gm, "\n$1\n")
        .replace(/^# (.+)$/gm, "\n$1\n")
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/\*(.+?)\*/g, "$1")
        .replace(/^- /gm, "• ");

      doc.fontSize(12).font("Helvetica").fillColor("#000000").text(content, {
        align: "left",
        lineGap: 4,
      });

      doc.end();
    } catch (error) {
      console.error("Error generating PDF:", error);
      res.status(500).json({ message: "Failed to generate PDF" });
    }
  });

  // Admin routes - Users
  app.get("/api/admin/users", isAuthenticated, async (req: any, res) => {
    try {
      // Check if user is admin
      const userId = req.user.claims.sub;
      const profile = await storage.getUserProfile(userId);
      
      if (profile?.name !== "Administrador") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.patch("/api/admin/users/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getUserProfile(userId);
      
      if (profile?.name !== "Administrador") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const { profileId, planId, isActive } = req.body;
      const user = await storage.updateUser(req.params.id, { profileId, planId, isActive });
      res.json(user);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Admin routes - Profiles
  app.get("/api/admin/profiles", isAuthenticated, async (req: any, res) => {
    try {
      const profiles = await storage.getProfiles();
      res.json(profiles);
    } catch (error) {
      console.error("Error fetching profiles:", error);
      res.status(500).json({ message: "Failed to fetch profiles" });
    }
  });

  app.post("/api/admin/profiles", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userProfile = await storage.getUserProfile(userId);
      
      if (userProfile?.name !== "Administrador") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const data = insertProfileSchema.parse(req.body);
      const profile = await storage.createProfile(data);
      res.json(profile);
    } catch (error: any) {
      console.error("Error creating profile:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Failed to create profile" });
    }
  });

  app.patch("/api/admin/profiles/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userProfile = await storage.getUserProfile(userId);
      
      if (userProfile?.name !== "Administrador") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const profile = await storage.updateProfile(req.params.id, req.body);
      res.json(profile);
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  app.delete("/api/admin/profiles/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userProfile = await storage.getUserProfile(userId);
      
      if (userProfile?.name !== "Administrador") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      await storage.deleteProfile(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting profile:", error);
      res.status(500).json({ message: "Failed to delete profile" });
    }
  });

  // Admin routes - Plans
  app.get("/api/admin/plans", isAuthenticated, async (req: any, res) => {
    try {
      const plans = await storage.getPlans();
      res.json(plans);
    } catch (error) {
      console.error("Error fetching plans:", error);
      res.status(500).json({ message: "Failed to fetch plans" });
    }
  });

  app.post("/api/admin/plans", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userProfile = await storage.getUserProfile(userId);
      
      if (userProfile?.name !== "Administrador") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const data = insertPlanSchema.parse(req.body);
      const plan = await storage.createPlan(data);
      res.json(plan);
    } catch (error: any) {
      console.error("Error creating plan:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Failed to create plan" });
    }
  });

  app.patch("/api/admin/plans/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userProfile = await storage.getUserProfile(userId);
      
      if (userProfile?.name !== "Administrador") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const plan = await storage.updatePlan(req.params.id, req.body);
      res.json(plan);
    } catch (error) {
      console.error("Error updating plan:", error);
      res.status(500).json({ message: "Failed to update plan" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { generateArtifactContent } from "./openai";
import { insertProfileSchema, insertPlanSchema, createManualUserSchema, ARTIFACT_TYPES, ARTIFACT_TYPE_LABELS, type ArtifactType } from "@shared/schema";
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
    templateId: z.string().optional(),
  });

  app.post("/api/artifacts/generate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { types, transcription, templateId } = generateArtifactsSchema.parse(req.body);

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

      // Get template content if templateId is provided
      let templateContent: string | undefined;
      if (templateId) {
        const template = await storage.getTemplate(templateId);
        if (template && template.userId === userId) {
          if (template.type === 'text' && template.content) {
            templateContent = template.content;
          } else if (template.type === 'file' && template.fileData) {
            templateContent = `[Arquivo de referência: ${template.fileName}]`;
          }
        }
      }

      const generatedArtifacts = [];

      for (const type of accessibleTypes) {
        const content = await generateArtifactContent(type as ArtifactType, transcription, templateContent);
        const title = `${ARTIFACT_TYPE_LABELS[type as ArtifactType]} - ${new Date().toLocaleDateString("pt-BR")}`;

        const artifact = await storage.createArtifact({
          userId,
          type,
          title,
          content,
          transcription,
          templateId: templateId || null,
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

      // Check if user owns the artifact or is an administrator
      const userId = req.user.claims.sub;
      const userProfile = await storage.getUserProfile(userId);
      const isAdmin = userProfile?.name === "Administrador";
      
      if (artifact.userId !== userId && !isAdmin) {
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

  // Download multiple artifacts as a combined PDF
  app.post("/api/artifacts/download-all", isAuthenticated, async (req: any, res) => {
    try {
      const { artifactIds } = req.body;
      const userId = req.user.claims.sub;

      if (!artifactIds || !Array.isArray(artifactIds) || artifactIds.length === 0) {
        return res.status(400).json({ message: "Forneça os IDs dos artefatos" });
      }

      // Fetch all artifacts and verify ownership
      const artifacts = [];
      for (const id of artifactIds) {
        const artifact = await storage.getArtifact(id);
        if (artifact && artifact.userId === userId) {
          artifacts.push(artifact);
        }
      }

      if (artifacts.length === 0) {
        return res.status(404).json({ message: "Nenhum artefato encontrado" });
      }

      // Generate combined PDF
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => {
        const pdfBuffer = Buffer.concat(chunks);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="artefatos_${new Date().toLocaleDateString("pt-BR").replace(/\//g, "-")}.pdf"`);
        res.send(pdfBuffer);
      });

      // Title page
      doc.fontSize(28).font("Helvetica-Bold").text("Artefatos Gerados", { align: "center" });
      doc.moveDown();
      doc.fontSize(12).font("Helvetica").fillColor("#666666")
        .text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, { align: "center" });
      doc.moveDown();
      doc.text(`Total de documentos: ${artifacts.length}`, { align: "center" });

      // Each artifact
      for (let i = 0; i < artifacts.length; i++) {
        const artifact = artifacts[i];
        
        doc.addPage();
        
        doc.fontSize(20).font("Helvetica-Bold").fillColor("#000000")
          .text(artifact.title, { align: "center" });
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

        doc.fontSize(11).font("Helvetica").fillColor("#000000").text(content, {
          align: "left",
          lineGap: 4,
        });
      }

      doc.end();
    } catch (error) {
      console.error("Error generating combined PDF:", error);
      res.status(500).json({ message: "Failed to generate PDF" });
    }
  });

  // Delete artifact
  app.delete("/api/artifacts/:id", isAuthenticated, async (req: any, res) => {
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

      await storage.deleteArtifact(req.params.id);
      res.json({ message: "Artefato excluído com sucesso" });
    } catch (error) {
      console.error("Error deleting artifact:", error);
      res.status(500).json({ message: "Failed to delete artifact" });
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

      const { email, profileId, planId, isActive } = req.body;
      const user = await storage.updateUser(req.params.id, { email, profileId, planId, isActive });
      res.json(user);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.post("/api/admin/users", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getUserProfile(userId);
      
      if (profile?.name !== "Administrador") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      // Validate request body with manual user schema
      const validationResult = createManualUserSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ message: validationResult.error.errors[0].message });
      }

      const { email, firstName, lastName, profileId, planId } = validationResult.data;

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "Já existe um usuário com este email" });
      }

      // Validate profileId exists if provided
      if (profileId) {
        const existingProfile = await storage.getProfile(profileId);
        if (!existingProfile) {
          return res.status(400).json({ message: "Perfil não encontrado" });
        }
      }

      // Validate planId exists if provided
      if (planId) {
        const existingPlan = await storage.getPlan(planId);
        if (!existingPlan) {
          return res.status(400).json({ message: "Plano não encontrado" });
        }
      }

      const user = await storage.createManualUser({ email, firstName, lastName, profileId, planId });
      res.json(user);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  // Admin routes - Artifacts
  app.get("/api/admin/artifacts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getUserProfile(userId);
      
      if (profile?.name !== "Administrador") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const artifacts = await storage.getAllArtifacts();
      res.json(artifacts);
    } catch (error) {
      console.error("Error fetching all artifacts:", error);
      res.status(500).json({ message: "Failed to fetch artifacts" });
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

  // Template routes
  app.get("/api/templates", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const templates = await storage.getTemplates(userId);
      res.json(templates);
    } catch (error) {
      console.error("Error fetching templates:", error);
      res.status(500).json({ message: "Failed to fetch templates" });
    }
  });

  app.get("/api/templates/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const template = await storage.getTemplate(req.params.id);
      
      if (!template) {
        return res.status(404).json({ message: "Template não encontrado" });
      }
      
      if (template.userId !== userId) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      
      res.json(template);
    } catch (error) {
      console.error("Error fetching template:", error);
      res.status(500).json({ message: "Failed to fetch template" });
    }
  });

  app.get("/api/templates/:id/download", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const template = await storage.getTemplate(req.params.id);
      
      if (!template) {
        return res.status(404).json({ message: "Template não encontrado" });
      }
      
      if (template.userId !== userId) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      
      if (template.type !== 'file' || !template.fileData || !template.fileName) {
        return res.status(400).json({ message: "Template não possui arquivo" });
      }
      
      const fileBuffer = Buffer.from(template.fileData, 'base64');
      res.setHeader('Content-Type', template.mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${template.fileName}"`);
      res.send(fileBuffer);
    } catch (error) {
      console.error("Error downloading template:", error);
      res.status(500).json({ message: "Failed to download template" });
    }
  });

  const createTemplateSchema = z.object({
    description: z.string().min(1, "Descrição é obrigatória"),
    type: z.enum(['text', 'file']),
    content: z.string().optional(),
    fileName: z.string().optional(),
    fileData: z.string().optional(),
    mimeType: z.string().optional(),
    fileSize: z.number().optional(),
  });

  const ALLOWED_MIME_TYPES = [
    'text/csv',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  app.post("/api/templates", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const data = createTemplateSchema.parse(req.body);

      if (data.type === 'text' && (!data.content || data.content.trim().length === 0)) {
        return res.status(400).json({ message: "Conteúdo do template é obrigatório" });
      }

      if (data.type === 'file') {
        if (!data.fileData || !data.fileName || !data.mimeType) {
          return res.status(400).json({ message: "Arquivo é obrigatório" });
        }

        if (!ALLOWED_MIME_TYPES.includes(data.mimeType)) {
          return res.status(400).json({ 
            message: "Formato de arquivo não permitido. Formatos aceitos: CSV, PDF, DOC, DOCX, XLS, XLSX" 
          });
        }

        if (data.fileSize && data.fileSize > MAX_FILE_SIZE) {
          return res.status(400).json({ message: "Arquivo excede o limite de 10MB" });
        }
      }

      const template = await storage.createTemplate({
        userId,
        description: data.description,
        type: data.type,
        content: data.type === 'text' ? data.content : null,
        fileName: data.type === 'file' ? data.fileName : null,
        fileData: data.type === 'file' ? data.fileData : null,
        mimeType: data.type === 'file' ? data.mimeType : null,
        fileSize: data.type === 'file' ? data.fileSize : null,
      });

      res.json(template);
    } catch (error: any) {
      console.error("Error creating template:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Failed to create template" });
    }
  });

  app.delete("/api/templates/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const template = await storage.getTemplate(req.params.id);
      
      if (!template) {
        return res.status(404).json({ message: "Template não encontrado" });
      }
      
      if (template.userId !== userId) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      
      await storage.deleteTemplate(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting template:", error);
      res.status(500).json({ message: "Failed to delete template" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { generateArtifactContent } from "./openai";
import { insertProfileSchema, insertPlanSchema, createManualUserSchema, ARTIFACT_TYPES } from "@shared/schema";
import { z } from "zod";
import PDFDocument from "pdfkit";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { Document, Paragraph, TextRun, Packer, HeadingLevel, AlignmentType } from "docx";
import { 
  extractPlaceholders, 
  extractPlaceholdersFromFile, 
  fillTemplate,
  validatePlaceholderMapping,
  type PlaceholderData 
} from "./template-processor";

// Parse markdown content into structured data for CSV/XLSX export
function parseMarkdownToStructuredData(
  content: string, 
  title: string, 
  createdAt: Date | null
): { headers: string[]; rows: string[][] } {
  const lines = content.split("\n");
  const rows: string[][] = [];
  let currentSection = title;
  let itemNumber = 1;

  // Headers for the spreadsheet
  const headers = ["N.", "Categoria", "Conteudo"];

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Skip empty lines
    if (!trimmedLine) continue;

    // Check if it's a header (section title)
    const headerMatch = trimmedLine.match(/^#{1,6}\s+(.+)$/);
    if (headerMatch) {
      currentSection = headerMatch[1]
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/\*(.+?)\*/g, "$1");
      continue;
    }

    // Check if it's a list item
    const listMatch = trimmedLine.match(/^[-*]\s+(.+)$/);
    if (listMatch) {
      const itemContent = listMatch[1]
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/\*(.+?)\*/g, "$1")
        .replace(/`(.+?)`/g, "$1");
      
      rows.push([String(itemNumber), currentSection, itemContent]);
      itemNumber++;
      continue;
    }

    // Check if it's a numbered list item
    const numberedMatch = trimmedLine.match(/^\d+[.)]\s+(.+)$/);
    if (numberedMatch) {
      const itemContent = numberedMatch[1]
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/\*(.+?)\*/g, "$1")
        .replace(/`(.+?)`/g, "$1");
      
      rows.push([String(itemNumber), currentSection, itemContent]);
      itemNumber++;
      continue;
    }

    // Regular text (not a header or list item)
    const cleanContent = trimmedLine
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/\*(.+?)\*/g, "$1")
      .replace(/`(.+?)`/g, "$1");
    
    // Skip horizontal rules and metadata lines
    if (cleanContent.match(/^[-_=]{3,}$/) || cleanContent.startsWith("Gerado em:")) {
      continue;
    }

    rows.push([String(itemNumber), currentSection, cleanContent]);
    itemNumber++;
  }

  // Add metadata row at the end
  if (createdAt) {
    const dateStr = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(createdAt));
    rows.push(["", "Metadata", `Gerado em: ${dateStr}`]);
  }

  return { headers, rows };
}

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
    types: z.array(z.string()).min(1, "Selecione pelo menos um tipo"),
    transcription: z.string().min(10, "Transcrição muito curta"),
    templateId: z.string().optional(),
    action: z.string().optional(),
  });

  app.post("/api/artifacts/generate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { types, transcription, templateId, action } = generateArtifactsSchema.parse(req.body);

      // Check user plan access
      const plan = await storage.getUserPlan(userId);
      const allowedTools = (plan?.tools as string[]) || [ARTIFACT_TYPES.BUSINESS_RULES];
      
      // Check if plan has all legacy types (Premium behavior - grants access to all types)
      const legacyTypes = ['business_rules', 'action_points', 'referrals', 'critical_points'];
      const hasAllLegacyTypes = legacyTypes.every(t => allowedTools.includes(t));

      // Filter types based on plan (Premium users with all legacy types get access to all)
      const accessibleTypes = hasAllLegacyTypes 
        ? types 
        : types.filter((type) => allowedTools.includes(type));

      if (accessibleTypes.length === 0) {
        return res.status(403).json({
          message: "Seu plano não permite acesso a essas ferramentas. Faça upgrade para desbloquear.",
        });
      }

      // Get all artifact types from database for lookup
      const allArtifactTypes = await storage.getArtifactTypes();
      const typeMap = new Map(allArtifactTypes.map(t => [t.slug, t]));

      // Get template content if templateId is provided
      let templateContent: string | undefined;
      if (templateId) {
        const template = await storage.getTemplate(templateId);
        if (template && template.userId === userId) {
          if (template.type === 'text' && template.content) {
            templateContent = template.content;
          } else if (template.type === 'file' && template.fileData) {
            // Decode file content based on MIME type
            const textMimeTypes = [
              'text/plain',
              'text/markdown',
              'text/html',
              'application/json',
            ];
            const docxMimeTypes = [
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'application/msword',
            ];
            
            if (template.mimeType && textMimeTypes.includes(template.mimeType)) {
              try {
                templateContent = Buffer.from(template.fileData, 'base64').toString('utf-8');
              } catch {
                templateContent = `[Arquivo de referência: ${template.fileName}]`;
              }
            } else if (template.mimeType && docxMimeTypes.includes(template.mimeType)) {
              // Extract text from Word documents using mammoth
              try {
                const fileBuffer = Buffer.from(template.fileData, 'base64');
                const result = await mammoth.extractRawText({ buffer: fileBuffer });
                templateContent = result.value;
                if (!templateContent || templateContent.trim().length === 0) {
                  templateContent = `[Template Word: ${template.fileName}]\n\nNota: Use o formato e estrutura típicos deste documento como referência.`;
                }
              } catch (err) {
                console.error("Error extracting text from Word document:", err);
                templateContent = `[Template Word: ${template.fileName}]\n\nNota: Use o formato e estrutura típicos de um documento Word como referência para organizar a saída.`;
              }
            } else {
              // For other binary files like PDF, provide filename as reference
              templateContent = `[Template de arquivo: ${template.fileName}]\n\nNota: Use o formato e estrutura típicos de um documento "${template.fileName}" como referência para organizar a saída.`;
            }
          }
        }
      }

      const generatedArtifacts = [];

      for (const typeSlug of accessibleTypes) {
        const artifactType = typeMap.get(typeSlug);
        const typeName = artifactType?.title || typeSlug;
        const typeDescription = artifactType?.description;
        const fileType = artifactType?.fileType || "pdf";
        
        // Use action from artifact type if enabled, otherwise use action from request
        const typeAction = (artifactType?.actionEnabled && artifactType?.action) ? artifactType.action : action;
        
        const content = await generateArtifactContent(typeSlug, typeName, transcription, typeDescription, templateContent, typeAction);
        const now = new Date();
        const dateStr = now.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
        const timeStr = now.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).replace(":", "h");
        const title = `${typeName} - ${dateStr} - ${timeStr}`;

        const artifact = await storage.createArtifact({
          userId,
          type: typeSlug,
          title,
          content,
          transcription,
          templateId: templateId || null,
          fileType,
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

  // Generic download endpoint that respects artifact fileType
  app.get("/api/artifacts/:id/download", isAuthenticated, async (req: any, res) => {
    try {
      const artifact = await storage.getArtifact(req.params.id);

      if (!artifact) {
        return res.status(404).json({ message: "Artefato não encontrado" });
      }

      const userId = req.user.claims.sub;
      const userProfile = await storage.getUserProfile(userId);
      const isAdmin = userProfile?.name === "Administrador";
      
      if (artifact.userId !== userId && !isAdmin) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const fileType = artifact.fileType || "pdf";
      const safeTitle = artifact.title.replace(/[^a-zA-Z0-9\s\-_]/g, "").trim().replace(/\s+/g, "-");
      
      // Generate timestamp for filename in Brasília timezone
      const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
      const dateStr = artifact.createdAt 
        ? dateFormatter.format(new Date(artifact.createdAt)).replace(/[/:]/g, "-").replace(/\s/g, "-")
        : "";
      const fileNameWithDate = dateStr ? `${safeTitle}-${dateStr}` : safeTitle;

      switch (fileType) {
        case "md":
          res.setHeader("Content-Type", "text/markdown; charset=utf-8");
          res.setHeader("Content-Disposition", `attachment; filename="${fileNameWithDate}.md"`);
          res.send(`# ${artifact.title}\n\n_Gerado em: ${new Date(artifact.createdAt!).toLocaleString("pt-BR")}_\n\n---\n\n${artifact.content}`);
          break;

        case "txt":
          const txtContent = artifact.content
            .replace(/^#{1,6}\s+(.+)$/gm, "$1")
            .replace(/\*\*(.+?)\*\*/g, "$1")
            .replace(/\*(.+?)\*/g, "$1")
            .replace(/`(.+?)`/g, "$1")
            .replace(/^[-*]\s+/gm, "- ");
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
          res.setHeader("Content-Disposition", `attachment; filename="${fileNameWithDate}.txt"`);
          res.send(`${artifact.title}\nGerado em: ${new Date(artifact.createdAt!).toLocaleString("pt-BR")}\n\n${txtContent}`);
          break;

        case "csv":
          // Parse markdown content into structured data with columns
          const csvStructuredData = parseMarkdownToStructuredData(artifact.content, artifact.title, artifact.createdAt);
          const csvHeader = csvStructuredData.headers.map(h => `"${h.replace(/"/g, '""')}"`).join(",");
          const csvRows = csvStructuredData.rows.map(row => 
            row.map(cell => `"${(cell || "").replace(/"/g, '""')}"`).join(",")
          );
          const csvOutput = [csvHeader, ...csvRows].join("\n");
          
          res.setHeader("Content-Type", "text/csv; charset=utf-8");
          res.setHeader("Content-Disposition", `attachment; filename="${fileNameWithDate}.csv"`);
          res.send("\uFEFF" + csvOutput); // BOM for Excel UTF-8 compatibility
          break;

        case "xlsx":
          // Parse markdown content into structured data with columns
          const xlsxStructuredData = parseMarkdownToStructuredData(artifact.content, artifact.title, artifact.createdAt);
          const xlsxSheetData: string[][] = [
            xlsxStructuredData.headers,
            ...xlsxStructuredData.rows
          ];
          
          const worksheet = XLSX.utils.aoa_to_sheet(xlsxSheetData);
          // Set column widths based on content
          worksheet["!cols"] = xlsxStructuredData.headers.map((_, i) => ({ 
            wch: i === 0 ? 8 : i === 1 ? 30 : 80 
          }));
          const workbook = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(workbook, worksheet, "Artefato");
          const xlsxBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
          
          res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
          res.setHeader("Content-Disposition", `attachment; filename="${fileNameWithDate}.xlsx"`);
          res.send(xlsxBuffer);
          break;

        case "docx":
          // Generate real DOCX file using docx library
          const docxContentLines = artifact.content.split("\n");
          const docxParagraphs: Paragraph[] = [
            new Paragraph({
              text: artifact.title,
              heading: HeadingLevel.TITLE,
              alignment: AlignmentType.CENTER
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Gerado em: ${new Date(artifact.createdAt!).toLocaleString("pt-BR")}`,
                  italics: true,
                  size: 20
                })
              ],
              alignment: AlignmentType.CENTER
            }),
            new Paragraph({ text: "" })
          ];
          
          docxContentLines.forEach(line => {
            if (line.startsWith("# ")) {
              docxParagraphs.push(new Paragraph({
                text: line.substring(2),
                heading: HeadingLevel.HEADING_1
              }));
            } else if (line.startsWith("## ")) {
              docxParagraphs.push(new Paragraph({
                text: line.substring(3),
                heading: HeadingLevel.HEADING_2
              }));
            } else if (line.startsWith("### ")) {
              docxParagraphs.push(new Paragraph({
                text: line.substring(4),
                heading: HeadingLevel.HEADING_3
              }));
            } else if (line.startsWith("- ") || line.startsWith("* ")) {
              docxParagraphs.push(new Paragraph({
                text: line.substring(2),
                bullet: { level: 0 }
              }));
            } else if (line.match(/^\d+\.\s/)) {
              docxParagraphs.push(new Paragraph({
                text: line.replace(/^\d+\.\s/, ""),
                numbering: { reference: "default-numbering", level: 0 }
              }));
            } else {
              const cleanText = line
                .replace(/\*\*(.+?)\*\*/g, "$1")
                .replace(/\*(.+?)\*/g, "$1");
              docxParagraphs.push(new Paragraph({ text: cleanText }));
            }
          });
          
          const docxDoc = new Document({
            numbering: {
              config: [{
                reference: "default-numbering",
                levels: [{
                  level: 0,
                  format: "decimal",
                  text: "%1.",
                  alignment: AlignmentType.LEFT
                }]
              }]
            },
            sections: [{
              properties: {},
              children: docxParagraphs
            }]
          });
          
          const docxBuffer = await Packer.toBuffer(docxDoc);
          res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
          res.setHeader("Content-Disposition", `attachment; filename="${fileNameWithDate}.docx"`);
          res.send(docxBuffer);
          break;
        case "pdf":
        default:
          const doc = new PDFDocument({ margin: 50 });
          const chunks: Buffer[] = [];

          doc.on("data", (chunk) => chunks.push(chunk));
          doc.on("end", () => {
            const pdfBuffer = Buffer.concat(chunks);
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `attachment; filename="${fileNameWithDate}.pdf"`);
            res.send(pdfBuffer);
          });

          doc.fontSize(24).font("Helvetica-Bold").text(artifact.title, { align: "center" });
          doc.moveDown();
          
          doc.fontSize(10).font("Helvetica").fillColor("#666666")
            .text(`Gerado em: ${new Date(artifact.createdAt!).toLocaleString("pt-BR")}`, { align: "center" });
          doc.moveDown(2);

          const pdfContent = artifact.content
            .replace(/^### (.+)$/gm, "\n$1\n")
            .replace(/^## (.+)$/gm, "\n$1\n")
            .replace(/^# (.+)$/gm, "\n$1\n")
            .replace(/\*\*(.+?)\*\*/g, "$1")
            .replace(/\*(.+?)\*/g, "$1")
            .replace(/^- /gm, "• ");

          doc.fontSize(12).font("Helvetica").fillColor("#000000").text(pdfContent, {
            align: "left",
            lineGap: 4,
          });

          doc.end();
          break;
      }
    } catch (error) {
      console.error("Error generating download:", error);
      res.status(500).json({ message: "Failed to generate download" });
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

  app.delete("/api/admin/plans/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userProfile = await storage.getUserProfile(userId);
      
      if (userProfile?.name !== "Administrador") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      await storage.deletePlan(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting plan:", error);
      res.status(500).json({ message: "Failed to delete plan" });
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

      let detectedPlaceholders: string[] = [];
      
      if (data.type === 'text' && data.content) {
        detectedPlaceholders = extractPlaceholders(data.content);
      } else if (data.type === 'file' && data.fileData && data.fileName && data.mimeType) {
        const fileBuffer = Buffer.from(data.fileData, 'base64');
        detectedPlaceholders = await extractPlaceholdersFromFile(fileBuffer, data.mimeType, data.fileName);
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
        placeholders: detectedPlaceholders,
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
      
      // Check ownership or admin role
      const userProfile = await storage.getUserProfile(userId);
      const isAdmin = userProfile?.name === "Administrador";
      
      if (template.userId !== userId && !isAdmin) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      
      await storage.deleteTemplate(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting template:", error);
      res.status(500).json({ message: "Failed to delete template" });
    }
  });

  const fillTemplateSchema = z.object({
    templateId: z.string().min(1, "Template é obrigatório"),
    data: z.record(z.string()),
  });

  app.post("/api/templates/:id/fill", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const template = await storage.getTemplate(req.params.id);
      
      if (!template) {
        return res.status(404).json({ message: "Template não encontrado" });
      }
      
      if (template.userId !== userId) {
        const userProfile = await storage.getUserProfile(userId);
        if (userProfile?.name !== "Administrador") {
          return res.status(403).json({ message: "Acesso negado" });
        }
      }
      
      const { data } = req.body as { data: PlaceholderData };
      
      if (!data || typeof data !== 'object') {
        return res.status(400).json({ message: "Dados de preenchimento são obrigatórios" });
      }
      
      const templatePlaceholders = template.placeholders || [];
      
      if (template.type === 'text') {
        let filledContent = template.content || "";
        
        for (const placeholder of templatePlaceholders) {
          const placeholderPattern = `{{${placeholder}}}`;
          const value = data[placeholder] || "";
          filledContent = filledContent.replace(new RegExp(placeholderPattern.replace(/[{}]/g, "\\$&"), "g"), value);
        }
        
        for (const [key, value] of Object.entries(data)) {
          const placeholder = `{{${key}}}`;
          filledContent = filledContent.replace(new RegExp(placeholder.replace(/[{}]/g, "\\$&"), "g"), value || "");
        }
        
        return res.json({
          success: true,
          type: 'text',
          content: filledContent,
        });
      }
      
      if (template.type === 'file' && template.fileData && template.fileName && template.mimeType) {
        const fileBuffer = Buffer.from(template.fileData, 'base64');
        const result = await fillTemplate(fileBuffer, template.mimeType, template.fileName, data, templatePlaceholders);
        
        if (!result.success) {
          return res.status(400).json({ message: result.error });
        }
        
        res.setHeader('Content-Type', result.mimeType || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
        return res.send(result.data);
      }
      
      return res.status(400).json({ message: "Template inválido para preenchimento" });
    } catch (error) {
      console.error("Error filling template:", error);
      res.status(500).json({ message: "Failed to fill template" });
    }
  });

  app.get("/api/templates/:id/placeholders", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const template = await storage.getTemplate(req.params.id);
      
      if (!template) {
        return res.status(404).json({ message: "Template não encontrado" });
      }
      
      if (template.userId !== userId) {
        const userProfile = await storage.getUserProfile(userId);
        if (userProfile?.name !== "Administrador") {
          return res.status(403).json({ message: "Acesso negado" });
        }
      }
      
      let placeholders: string[] = template.placeholders || [];
      
      if (placeholders.length === 0) {
        if (template.type === 'text' && template.content) {
          placeholders = extractPlaceholders(template.content);
        } else if (template.type === 'file' && template.fileData && template.fileName && template.mimeType) {
          const fileBuffer = Buffer.from(template.fileData, 'base64');
          placeholders = await extractPlaceholdersFromFile(fileBuffer, template.mimeType, template.fileName);
        }
      }
      
      res.json({ placeholders });
    } catch (error) {
      console.error("Error getting template placeholders:", error);
      res.status(500).json({ message: "Failed to get placeholders" });
    }
  });

  // Artifact types routes (public list, admin CRUD)
  app.get("/api/artifact-types", async (_req, res) => {
    try {
      const types = await storage.getArtifactTypes();
      res.json(types);
    } catch (error) {
      console.error("Error fetching artifact types:", error);
      res.status(500).json({ message: "Failed to fetch artifact types" });
    }
  });

  const createArtifactTypeSchema = z.object({
    slug: z.string().min(1, "Slug é obrigatório").regex(/^[a-z0-9_]+$/, "Slug deve conter apenas letras minúsculas, números e underscore"),
    title: z.string().min(1, "Título é obrigatório"),
    description: z.string().optional(),
    fileType: z.string().optional().default("pdf"),
    actionEnabled: z.boolean().optional().default(false),
    action: z.string().optional(),
    isActive: z.boolean().optional().default(true),
  });

  app.post("/api/admin/artifact-types", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userProfile = await storage.getUserProfile(userId);
      
      if (userProfile?.name !== "Administrador") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const data = createArtifactTypeSchema.parse(req.body);
      
      // Check if slug already exists
      const existing = await storage.getArtifactTypeBySlug(data.slug);
      if (existing) {
        return res.status(400).json({ message: "Já existe um tipo de artefato com este slug" });
      }

      const type = await storage.createArtifactType(data);
      res.json(type);
    } catch (error: any) {
      console.error("Error creating artifact type:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Failed to create artifact type" });
    }
  });

  app.patch("/api/admin/artifact-types/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userProfile = await storage.getUserProfile(userId);
      
      if (userProfile?.name !== "Administrador") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const { title, slug, description, fileType, actionEnabled, action, isActive } = req.body;
      const type = await storage.updateArtifactType(req.params.id, { 
        title, 
        slug, 
        description, 
        fileType,
        actionEnabled,
        action,
        isActive 
      });
      res.json(type);
    } catch (error) {
      console.error("Error updating artifact type:", error);
      res.status(500).json({ message: "Failed to update artifact type" });
    }
  });

  app.delete("/api/admin/artifact-types/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userProfile = await storage.getUserProfile(userId);
      
      if (userProfile?.name !== "Administrador") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      await storage.deleteArtifactType(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting artifact type:", error);
      res.status(500).json({ message: "Failed to delete artifact type" });
    }
  });

  // ==========================================
  // CLIENT ROUTES
  // ==========================================

  const createClientSchema = z.object({
    name: z.string().min(1, "Nome é obrigatório"),
    email: z.string().email("Email inválido"),
    phone: z.string().optional(),
    cpf: z.string().min(11, "CPF inválido").max(14, "CPF inválido"),
    address: z.string().optional(),
  });

  app.get("/api/admin/clients", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userProfile = await storage.getUserProfile(userId);
      
      if (userProfile?.name !== "Administrador") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const clients = await storage.getClients();
      res.json(clients);
    } catch (error) {
      console.error("Error fetching clients:", error);
      res.status(500).json({ message: "Failed to fetch clients" });
    }
  });

  app.get("/api/admin/clients/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userProfile = await storage.getUserProfile(userId);
      
      if (userProfile?.name !== "Administrador") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const client = await storage.getClient(req.params.id);
      if (!client) {
        return res.status(404).json({ message: "Cliente não encontrado" });
      }
      res.json(client);
    } catch (error) {
      console.error("Error fetching client:", error);
      res.status(500).json({ message: "Failed to fetch client" });
    }
  });

  app.post("/api/admin/clients", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userProfile = await storage.getUserProfile(userId);
      
      if (userProfile?.name !== "Administrador") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const data = createClientSchema.parse(req.body);
      
      // Check if CPF already exists
      const existing = await storage.getClientByCpf(data.cpf);
      if (existing) {
        return res.status(400).json({ message: "Já existe um cliente com este CPF" });
      }

      const client = await storage.createClient(data);
      res.json(client);
    } catch (error: any) {
      console.error("Error creating client:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Failed to create client" });
    }
  });

  app.patch("/api/admin/clients/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userProfile = await storage.getUserProfile(userId);
      
      if (userProfile?.name !== "Administrador") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const client = await storage.updateClient(req.params.id, req.body);
      res.json(client);
    } catch (error) {
      console.error("Error updating client:", error);
      res.status(500).json({ message: "Failed to update client" });
    }
  });

  app.delete("/api/admin/clients/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userProfile = await storage.getUserProfile(userId);
      
      if (userProfile?.name !== "Administrador") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      await storage.deleteClient(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting client:", error);
      res.status(500).json({ message: "Failed to delete client" });
    }
  });

  // ==========================================
  // SUBSCRIPTION ROUTES
  // ==========================================

  const createSubscriptionSchema = z.object({
    clientId: z.string().min(1, "Cliente é obrigatório"),
    planId: z.string().min(1, "Plano é obrigatório"),
    startDate: z.string().min(1, "Data de início é obrigatória"),
    billingDay: z.number().min(1).max(28).optional(),
  });

  app.get("/api/admin/subscriptions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userProfile = await storage.getUserProfile(userId);
      
      if (userProfile?.name !== "Administrador") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const subscriptions = await storage.getSubscriptions();
      res.json(subscriptions);
    } catch (error) {
      console.error("Error fetching subscriptions:", error);
      res.status(500).json({ message: "Failed to fetch subscriptions" });
    }
  });

  app.get("/api/admin/subscriptions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userProfile = await storage.getUserProfile(userId);
      
      if (userProfile?.name !== "Administrador") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const subscription = await storage.getSubscription(req.params.id);
      if (!subscription) {
        return res.status(404).json({ message: "Assinatura não encontrada" });
      }
      res.json(subscription);
    } catch (error) {
      console.error("Error fetching subscription:", error);
      res.status(500).json({ message: "Failed to fetch subscription" });
    }
  });

  app.get("/api/admin/clients/:clientId/subscriptions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userProfile = await storage.getUserProfile(userId);
      
      if (userProfile?.name !== "Administrador") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const subscriptions = await storage.getClientSubscriptions(req.params.clientId);
      res.json(subscriptions);
    } catch (error) {
      console.error("Error fetching client subscriptions:", error);
      res.status(500).json({ message: "Failed to fetch subscriptions" });
    }
  });

  app.post("/api/admin/subscriptions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userProfile = await storage.getUserProfile(userId);
      
      if (userProfile?.name !== "Administrador") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const data = createSubscriptionSchema.parse(req.body);
      
      // Verify client exists
      const client = await storage.getClient(data.clientId);
      if (!client) {
        return res.status(400).json({ message: "Cliente não encontrado" });
      }

      // Verify plan exists
      const plan = await storage.getPlan(data.planId);
      if (!plan) {
        return res.status(400).json({ message: "Plano não encontrado" });
      }

      const subscription = await storage.createSubscription({
        clientId: data.clientId,
        planId: data.planId,
        startDate: new Date(data.startDate),
        billingDay: data.billingDay || new Date(data.startDate).getDate(),
        status: "ativa",
      });

      // Create first invoice (auto-approved as per requirements - no gateway yet)
      const now = new Date();
      const referenceMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const dueDate = new Date(data.startDate);

      await storage.createInvoice({
        subscriptionId: subscription.id,
        clientId: data.clientId,
        amount: plan.price || 0,
        dueDate,
        status: "paga", // Auto-approved as per requirements
        referenceMonth,
      });

      res.json(subscription);
    } catch (error: any) {
      console.error("Error creating subscription:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Failed to create subscription" });
    }
  });

  app.patch("/api/admin/subscriptions/:id/cancel", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userProfile = await storage.getUserProfile(userId);
      
      if (userProfile?.name !== "Administrador") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const subscription = await storage.cancelSubscription(req.params.id);
      res.json(subscription);
    } catch (error) {
      console.error("Error canceling subscription:", error);
      res.status(500).json({ message: "Failed to cancel subscription" });
    }
  });

  app.patch("/api/admin/subscriptions/:id/activate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userProfile = await storage.getUserProfile(userId);
      
      if (userProfile?.name !== "Administrador") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const subscription = await storage.activateSubscription(req.params.id);
      res.json(subscription);
    } catch (error) {
      console.error("Error activating subscription:", error);
      res.status(500).json({ message: "Failed to activate subscription" });
    }
  });

  // ==========================================
  // INVOICE ROUTES
  // ==========================================

  app.get("/api/admin/invoices", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userProfile = await storage.getUserProfile(userId);
      
      if (userProfile?.name !== "Administrador") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const invoices = await storage.getInvoices();
      res.json(invoices);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  app.get("/api/admin/invoices/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userProfile = await storage.getUserProfile(userId);
      
      if (userProfile?.name !== "Administrador") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ message: "Mensalidade não encontrada" });
      }
      res.json(invoice);
    } catch (error) {
      console.error("Error fetching invoice:", error);
      res.status(500).json({ message: "Failed to fetch invoice" });
    }
  });

  app.get("/api/admin/clients/:clientId/invoices", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userProfile = await storage.getUserProfile(userId);
      
      if (userProfile?.name !== "Administrador") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const invoices = await storage.getClientInvoices(req.params.clientId);
      res.json(invoices);
    } catch (error) {
      console.error("Error fetching client invoices:", error);
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  app.patch("/api/admin/invoices/:id/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userProfile = await storage.getUserProfile(userId);
      
      if (userProfile?.name !== "Administrador") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const { status } = req.body;
      if (!["pendente", "paga", "atrasada"].includes(status)) {
        return res.status(400).json({ message: "Status inválido" });
      }

      const invoice = await storage.updateInvoiceStatus(req.params.id, status);
      
      // Update client status based on overdue invoices
      const clientInvoices = await storage.getClientInvoices(invoice.clientId);
      const hasOverdue = clientInvoices.some(inv => inv.status === "atrasada");
      const newClientStatus = hasOverdue ? "inadimplente" : "ativo";
      await storage.updateClientStatus(invoice.clientId, newClientStatus);

      res.json(invoice);
    } catch (error) {
      console.error("Error updating invoice status:", error);
      res.status(500).json({ message: "Failed to update invoice status" });
    }
  });

  // ==========================================
  // PAYMENT ROUTES
  // ==========================================

  const createPaymentSchema = z.object({
    invoiceId: z.string().min(1, "Mensalidade é obrigatória"),
    amount: z.number().min(1, "Valor é obrigatório"),
    paymentMethod: z.string().optional(),
    notes: z.string().optional(),
  });

  app.get("/api/admin/payments", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userProfile = await storage.getUserProfile(userId);
      
      if (userProfile?.name !== "Administrador") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const payments = await storage.getPayments();
      res.json(payments);
    } catch (error) {
      console.error("Error fetching payments:", error);
      res.status(500).json({ message: "Failed to fetch payments" });
    }
  });

  app.get("/api/admin/clients/:clientId/payments", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userProfile = await storage.getUserProfile(userId);
      
      if (userProfile?.name !== "Administrador") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const payments = await storage.getClientPayments(req.params.clientId);
      res.json(payments);
    } catch (error) {
      console.error("Error fetching client payments:", error);
      res.status(500).json({ message: "Failed to fetch payments" });
    }
  });

  app.post("/api/admin/payments", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userProfile = await storage.getUserProfile(userId);
      
      if (userProfile?.name !== "Administrador") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const data = createPaymentSchema.parse(req.body);
      
      // Verify invoice exists
      const invoice = await storage.getInvoice(data.invoiceId);
      if (!invoice) {
        return res.status(400).json({ message: "Mensalidade não encontrada" });
      }

      // Validate payment amount
      if (data.amount < invoice.amount) {
        return res.status(400).json({ message: "Valor pago não pode ser menor que o valor da mensalidade" });
      }

      const payment = await storage.createPayment({
        invoiceId: data.invoiceId,
        clientId: invoice.clientId,
        amount: data.amount,
        paymentMethod: data.paymentMethod || "manual",
        notes: data.notes,
        status: "aprovado",
      });

      // Update invoice status to paid
      await storage.updateInvoiceStatus(data.invoiceId, "paga");

      // Update client status - check if all overdue invoices are paid
      const clientInvoices = await storage.getClientInvoices(invoice.clientId);
      const hasOverdue = clientInvoices.some(inv => inv.status === "atrasada");
      const newClientStatus = hasOverdue ? "inadimplente" : "ativo";
      await storage.updateClientStatus(invoice.clientId, newClientStatus);

      res.json(payment);
    } catch (error: any) {
      console.error("Error creating payment:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Failed to create payment" });
    }
  });

  // ==========================================
  // REPORTS ROUTES
  // ==========================================

  app.get("/api/admin/reports/active-clients", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userProfile = await storage.getUserProfile(userId);
      
      if (userProfile?.name !== "Administrador") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const allClients = await storage.getClients();
      const activeClients = allClients.filter(c => c.status === "ativo");
      res.json({ clients: activeClients, total: activeClients.length });
    } catch (error) {
      console.error("Error fetching active clients report:", error);
      res.status(500).json({ message: "Failed to fetch report" });
    }
  });

  app.get("/api/admin/reports/overdue-clients", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userProfile = await storage.getUserProfile(userId);
      
      if (userProfile?.name !== "Administrador") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const allClients = await storage.getClients();
      const overdueClients = allClients.filter(c => c.status === "inadimplente");
      res.json({ clients: overdueClients, total: overdueClients.length });
    } catch (error) {
      console.error("Error fetching overdue clients report:", error);
      res.status(500).json({ message: "Failed to fetch report" });
    }
  });

  app.get("/api/admin/reports/financial", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userProfile = await storage.getUserProfile(userId);
      
      if (userProfile?.name !== "Administrador") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const invoices = await storage.getInvoices();
      const payments = await storage.getPayments();

      // Group by reference month
      const byMonth: Record<string, { invoiced: number; paid: number; pending: number; overdue: number }> = {};
      
      for (const invoice of invoices) {
        const month = invoice.referenceMonth;
        if (!byMonth[month]) {
          byMonth[month] = { invoiced: 0, paid: 0, pending: 0, overdue: 0 };
        }
        byMonth[month].invoiced += invoice.amount;
        if (invoice.status === "paga") {
          byMonth[month].paid += invoice.amount;
        } else if (invoice.status === "atrasada") {
          byMonth[month].overdue += invoice.amount;
        } else {
          byMonth[month].pending += invoice.amount;
        }
      }

      const totals = {
        totalInvoiced: invoices.reduce((sum, inv) => sum + inv.amount, 0),
        totalPaid: invoices.filter(inv => inv.status === "paga").reduce((sum, inv) => sum + inv.amount, 0),
        totalPending: invoices.filter(inv => inv.status === "pendente").reduce((sum, inv) => sum + inv.amount, 0),
        totalOverdue: invoices.filter(inv => inv.status === "atrasada").reduce((sum, inv) => sum + inv.amount, 0),
      };

      res.json({ byMonth, totals });
    } catch (error) {
      console.error("Error fetching financial report:", error);
      res.status(500).json({ message: "Failed to fetch report" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

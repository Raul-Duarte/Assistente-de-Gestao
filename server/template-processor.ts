import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import * as XLSX from "xlsx";

const PLACEHOLDER_REGEX = /\{\{([A-Z_][A-Z0-9_]*)\}\}/g;

export interface PlaceholderData {
  [key: string]: string;
}

export interface ProcessingResult {
  success: boolean;
  data?: Buffer;
  mimeType?: string;
  fileName?: string;
  error?: string;
}

export function extractPlaceholders(content: string): string[] {
  const matches = content.match(PLACEHOLDER_REGEX);
  if (!matches) return [];
  
  const placeholders = matches.map(match => match.replace(/\{\{|\}\}/g, ""));
  return Array.from(new Set(placeholders));
}

export async function extractPlaceholdersFromFile(
  fileData: Buffer,
  mimeType: string,
  fileName: string
): Promise<string[]> {
  try {
    if (mimeType.includes("spreadsheet") || fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      return extractPlaceholdersFromExcel(fileData);
    }
    
    if (mimeType.includes("document") || fileName.endsWith(".docx") || fileName.endsWith(".doc")) {
      return extractPlaceholdersFromDocx(fileData);
    }
    
    if (mimeType === "text/csv" || fileName.endsWith(".csv")) {
      return extractPlaceholdersFromCsv(fileData);
    }
    
    if (mimeType === "application/pdf" || fileName.endsWith(".pdf")) {
      return [];
    }
    
    return [];
  } catch (error) {
    console.error("Error extracting placeholders:", error);
    return [];
  }
}

function extractPlaceholdersFromDocx(fileData: Buffer): string[] {
  try {
    const zip = new PizZip(fileData);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: "{{", end: "}}" },
    });
    
    const text = doc.getFullText();
    return extractPlaceholders(text);
  } catch (error) {
    console.error("Error extracting placeholders from DOCX:", error);
    return [];
  }
}

function extractPlaceholdersFromExcel(fileData: Buffer): string[] {
  try {
    const workbook = XLSX.read(fileData, { type: "buffer" });
    const placeholders: string[] = [];
    
    workbook.SheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
      
      for (let row = range.s.r; row <= range.e.r; row++) {
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
          const cell = worksheet[cellAddress];
          
          if (cell && cell.v && typeof cell.v === "string") {
            const found = extractPlaceholders(cell.v);
            placeholders.push(...found);
          }
        }
      }
    });
    
    return Array.from(new Set(placeholders));
  } catch (error) {
    console.error("Error extracting placeholders from Excel:", error);
    return [];
  }
}

function extractPlaceholdersFromCsv(fileData: Buffer): string[] {
  try {
    const content = fileData.toString("utf-8");
    return extractPlaceholders(content);
  } catch (error) {
    console.error("Error extracting placeholders from CSV:", error);
    return [];
  }
}

export async function fillTemplate(
  fileData: Buffer,
  mimeType: string,
  fileName: string,
  data: PlaceholderData,
  templatePlaceholders?: string[]
): Promise<ProcessingResult> {
  try {
    const normalizedData = normalizeDataForPlaceholders(data, templatePlaceholders || []);
    
    if (mimeType.includes("spreadsheet") || fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      return fillExcelTemplate(fileData, fileName, normalizedData, templatePlaceholders);
    }
    
    if (mimeType.includes("document") || fileName.endsWith(".docx") || fileName.endsWith(".doc")) {
      return fillDocxTemplate(fileData, fileName, normalizedData, templatePlaceholders);
    }
    
    if (mimeType === "text/csv" || fileName.endsWith(".csv")) {
      return fillCsvTemplate(fileData, fileName, normalizedData, templatePlaceholders);
    }
    
    if (mimeType === "application/pdf" || fileName.endsWith(".pdf")) {
      return {
        success: false,
        error: "Este PDF não permite preenchimento automático. Use DOCX ou XLSX.",
      };
    }
    
    return {
      success: false,
      error: "Tipo de arquivo não suportado para preenchimento de template.",
    };
  } catch (error: any) {
    console.error("Error filling template:", error);
    return {
      success: false,
      error: error.message || "Erro ao preencher template.",
    };
  }
}

function normalizeDataForPlaceholders(
  data: PlaceholderData,
  templatePlaceholders: string[]
): PlaceholderData {
  const normalized: PlaceholderData = {};
  
  for (const placeholder of templatePlaceholders) {
    normalized[placeholder] = data[placeholder] || "";
  }
  
  for (const [key, value] of Object.entries(data)) {
    if (!(key in normalized)) {
      normalized[key] = value || "";
    }
  }
  
  return normalized;
}

export function stripHtmlForPlainText(content: string): string {
  return content
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .trim();
}

function fillDocxTemplate(
  fileData: Buffer,
  fileName: string,
  data: PlaceholderData,
  templatePlaceholders?: string[]
): ProcessingResult {
  try {
    const zip = new PizZip(fileData);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: "{{", end: "}}" },
    });
    
    const templateData: { [key: string]: string } = {};
    
    if (templatePlaceholders && templatePlaceholders.length > 0) {
      for (const placeholder of templatePlaceholders) {
        templateData[placeholder] = data[placeholder] || "";
      }
    }
    
    for (const [key, value] of Object.entries(data)) {
      templateData[key] = value || "";
    }
    
    doc.render(templateData);
    
    const outputBuffer = doc.getZip().generate({
      type: "nodebuffer",
      compression: "DEFLATE",
    });
    
    const outputFileName = fileName.replace(/\.(docx|doc)$/i, "_preenchido.docx");
    
    return {
      success: true,
      data: outputBuffer,
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileName: outputFileName,
    };
  } catch (error: any) {
    console.error("Error filling DOCX template:", error);
    return {
      success: false,
      error: `Erro ao preencher DOCX: ${error.message}`,
    };
  }
}

function fillExcelTemplate(
  fileData: Buffer,
  fileName: string,
  data: PlaceholderData,
  templatePlaceholders?: string[]
): ProcessingResult {
  try {
    const workbook = XLSX.read(fileData, { type: "buffer" });
    
    workbook.SheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
      
      for (let row = range.s.r; row <= range.e.r; row++) {
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
          const cell = worksheet[cellAddress];
          
          if (cell && cell.v && typeof cell.v === "string") {
            let cellValue = cell.v;
            
            for (const [key, value] of Object.entries(data)) {
              const placeholder = `{{${key}}}`;
              cellValue = cellValue.replace(new RegExp(placeholder.replace(/[{}]/g, "\\$&"), "g"), value || "");
            }
            
            if (cellValue !== cell.v) {
              cell.v = cellValue;
              cell.w = cellValue;
            }
          }
        }
      }
    });
    
    const outputBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    const outputFileName = fileName.replace(/\.(xlsx|xls)$/i, "_preenchido.xlsx");
    
    return {
      success: true,
      data: outputBuffer,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      fileName: outputFileName,
    };
  } catch (error: any) {
    console.error("Error filling Excel template:", error);
    return {
      success: false,
      error: `Erro ao preencher Excel: ${error.message}`,
    };
  }
}

function fillCsvTemplate(
  fileData: Buffer,
  fileName: string,
  data: PlaceholderData,
  templatePlaceholders?: string[]
): ProcessingResult {
  try {
    let content = fileData.toString("utf-8");
    
    for (const [key, value] of Object.entries(data)) {
      const placeholder = `{{${key}}}`;
      content = content.replace(new RegExp(placeholder.replace(/[{}]/g, "\\$&"), "g"), value || "");
    }
    
    const outputBuffer = Buffer.from(content, "utf-8");
    const outputFileName = fileName.replace(/\.csv$/i, "_preenchido.csv");
    
    return {
      success: true,
      data: outputBuffer,
      mimeType: "text/csv",
      fileName: outputFileName,
    };
  } catch (error: any) {
    console.error("Error filling CSV template:", error);
    return {
      success: false,
      error: `Erro ao preencher CSV: ${error.message}`,
    };
  }
}

export function validatePlaceholderMapping(
  templatePlaceholders: string[],
  providedData: PlaceholderData
): { missing: string[]; extra: string[] } {
  const providedKeys = Object.keys(providedData);
  
  const missing = templatePlaceholders.filter(p => !providedKeys.includes(p));
  const extra = providedKeys.filter(k => !templatePlaceholders.includes(k));
  
  return { missing, extra };
}

export function generatePlaceholderDataFromAI(
  aiContent: string,
  placeholders: string[]
): PlaceholderData {
  const data: PlaceholderData = {};
  
  for (const placeholder of placeholders) {
    data[placeholder] = aiContent || "Campo não encontrado";
  }
  
  return data;
}

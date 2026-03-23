import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { ensureDir, getTmpDir } from "../utils/fileHelper.js";

function drawCallout(doc, type, content) {
  const colors = {
    TIP: { bg: "#FFFDE7", border: "#FBC02D", text: "#455A64", label: "MASTER TIP" },
    DEF: { bg: "#E0F2F1", border: "#00796B", text: "#004D40", label: "KEY CONCEPT" },
    HINT: { bg: "#F3E5F5", border: "#7B1FA2", text: "#4A148C", label: "ANALYTICAL HINT" },
    EX: { bg: "#E3F2FD", border: "#1976D2", text: "#0D47A1", label: "PRACTICAL EXAMPLE" }
  };
  const theme = colors[type] || colors.TIP;

  doc.moveDown(0.8);
  const startX = doc.x;
  const width = 480;

  // Calculate height
  doc.font("BodyFont").fontSize(11);
  const textHeight = doc.heightOfString(content || " ", { width: width - 30 }) || 20;
  const rectHeight = textHeight + 28;

  if (doc.y + rectHeight > 750) doc.addPage();

  const currentY = doc.y;

  // Background
  doc.roundedRect(startX, currentY, width, rectHeight, 4).fill(theme.bg);
  // Accent bar
  doc.rect(startX, currentY, 4, rectHeight).fill(theme.border);

  // Label
  doc.fillColor(theme.border).font("HeadingFont").fontSize(8).text(theme.label, startX + 15, currentY + 8);
  
  // Content
  doc.fillColor(theme.text).font("BodyFont").fontSize(11).text(content || "", startX + 15, currentY + 20, { width: width - 30, lineGap: 2 });
  
  doc.y = currentY + rectHeight + 10;
}

function renderSmartContent(doc, text) {
  // Hardened Scrubber: Remove visual blocks (mermaid, chartjs, d2) regardless of case or spacing
  const cleanBase = text.replace(/```\s*(mermaid|d2|chartjs)[\s\S]*?```/gi, "").trim();

  // Split by headings and callouts
  const lines = cleanBase.split("\n");

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    if (line.startsWith("# ")) {
      // Main Heading
      doc.moveDown(1.5);
      if (doc.y > 650) doc.addPage();
      const heading = line.replace("# ", "").toUpperCase();
      doc.fillColor("#102027").font("HeadingFont").fontSize(18).text(heading);
      doc.rect(doc.x, doc.y, 40, 3).fill("#102027");
      doc.moveDown(1);
    } else if (line.startsWith("## ")) {
      // Sub Heading
      doc.moveDown(1);
      if (doc.y > 700) doc.addPage();
      const subHeading = line.replace("## ", "");
      doc.fillColor("#37474F").font("HeadingFont").fontSize(14).text(subHeading);
      doc.moveDown(0.5);
    } else if (line.startsWith("[TIP:") || line.startsWith("[DEF:") || line.startsWith("[HINT:") || line.startsWith("[EX:")) {
      const type = line.substring(1, line.indexOf(":"));
      const content = line.substring(line.indexOf(":") + 1, line.length - 1).trim();
      drawCallout(doc, type, content);
    } else {
      // Normal text
      if (doc.y > 720) doc.addPage();
      
      // Handle bold markers in text (basic implementation)
      const cleanText = line.replace(/\*\*(.*?)\*\*/g, "$1");
      doc.fillColor("#263238").font("BodyFont").fontSize(11.5).text(cleanText, {
        lineGap: 5,
        align: 'justify',
        paragraphGap: 4
      });
    }
  }
}

function addFooter(doc) {
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    const oldBottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    
    doc.fillColor("#90A4AE")
       .font("BodyFont")
       .fontSize(8)
       .text(
         `Page ${i + 1} of ${pages.count}  |  StudyAI Masterclass Guide  |  Personalized Study Assistance`,
         54,
         doc.page.height - 40,
         { align: "center", width: doc.page.width - 108 }
       );
    
    doc.page.margins.bottom = oldBottomMargin;
  }
}

export async function createNotesPdf({ notes, transcript, diagramBuffers, chartBuffers = [], visualImagePaths = [], topic = "Class Session", isPro = false }) {
  try {
    const tmpDir = getTmpDir();
    await ensureDir(tmpDir);

    const pdfPath = path.join(tmpDir, `${uuidv4()}.pdf`);
    const doc = new PDFDocument({
      size: "A4",
      margin: 60,
      bufferPages: true,
      info: { Title: `Masterclass Notes - ${topic}` }
    });

    await new Promise((resolve, reject) => {
      const stream = fs.createWriteStream(pdfPath);
      doc.pipe(stream);

      const boldFontPath = path.join(__dirname, "..", "fonts", "HumanFont-Bold.ttf");
      const regularFontPath = path.join(__dirname, "..", "fonts", "HumanFont.ttf");
      const secondaryFontPath = path.join(__dirname, "..", "fonts", "Baloo.ttf");
      
      doc.registerFont("HeadingFont", secondaryFontPath);
      doc.registerFont("BodyFontBold", boldFontPath);
      doc.registerFont("BodyFont", regularFontPath);

      // --- Custom Background ---
      doc.on('pageAdded', () => {
        doc.rect(0, 0, doc.page.width, doc.page.height).fill("#FAF9F6"); // Ghost White Paper feel
      });
      // Fill first page bg (since on('pageAdded') won't fire for page 1)
      doc.rect(0, 0, doc.page.width, doc.page.height).fill("#FAF9F6");

      // --- PAGE 1: PREMIUM HERO ---
      doc.rect(0, 0, doc.page.width, 180).fill("#102027"); 
      if (isPro) {
        doc.fillColor("#FFD700").font("HeadingFont").fontSize(10).text("AERO PRO EXCLUSIVE", 60, 30);
      }
      doc.fillColor("#ffffff").font("HeadingFont").fontSize(32).text("STUDY NOTES", 60, 50);
      doc.fontSize(14).font("BodyFont").text("MASTERCLASS SERIES", 60, 85);
      
      // Topic Badge
      doc.roundedRect(60, 115, 300, 40, 4).fill("#263238");
      doc.fillColor("#ECEFF1").font("HeadingFont").fontSize(9).text("TOPIC / SESSION", 72, 122);
      doc.fillColor("#ffffff").fontSize(12).text(topic.toUpperCase(), 72, 134, { width: 280, ellipsis: true });

      doc.y = 220;
      
      // --- CONTENT ---
      renderSmartContent(doc, notes || "");

      // --- VISUAL ANALYSIS (Integrated Hero Style) ---
      const allVisuals = [
        ...(diagramBuffers || []).map(b => ({ buffer: b, type: 'DIAGRAM', color: "#1B5E20", label: "CONCEPTUAL VISUAL" })),
        ...(chartBuffers || []).map(b => ({ buffer: b, type: 'CHART', color: "#1A237E", label: "DATA INSIGHT" }))
      ];

      if (allVisuals.length > 0) {
        doc.addPage();
        doc.rect(0, 0, doc.page.width, 50).fill("#102027");
        doc.fillColor("#ffffff").font("HeadingFont").fontSize(18).text("VISUAL ANALYSIS & DATA", 60, 15);
        doc.y = 80;

        for (let i = 0; i < allVisuals.length; i++) {
          const item = allVisuals[i];
          const imgHeight = 320; // Estimated height with padding
          
          if (doc.y + imgHeight > 750) {
            doc.addPage();
            doc.y = 40; 
          }

          try {
            const startY = doc.y;
            doc.image(item.buffer, {
               fit: [480, 280],
               align: 'center'
            });
            doc.moveDown(1);
            doc.fillColor(item.color).font("HeadingFont").fontSize(9).text(`${item.label} #${i+1}`, { align: "center" });
            doc.moveDown(2);
          } catch (e) {
            console.error("[PDF] Image render error:", e.message);
          }
        }
      }

      // --- TRANSCRIPT (Condensed) ---
      if (transcript && transcript.trim().length > 0) {
         doc.addPage();
         doc.rect(0, 0, doc.page.width, 40).fill("#37474F");
         doc.fillColor("#ffffff").font("HeadingFont").fontSize(14).text("SESSION RECORDING TRANSCRIPT", 60, 14);
         doc.moveDown(2);
         doc.fillColor("#546E7A").font("BodyFont").fontSize(7).text(transcript || "", { 
           lineGap: 1, 
           columns: 2, 
           columnGap: 30,
           align: 'justify'
         });
      }

      addFooter(doc);
      doc.end();
      stream.on("finish", resolve);
      stream.on("error", reject);
    });

    return pdfPath;
  } catch (err) {
    throw Object.assign(new Error(`PDF upgrade error: ${err.message}`), { statusCode: err.statusCode || 500 });
  }
}


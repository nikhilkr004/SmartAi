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
    TIP: { bg: "#FFF9C4", border: "#FBC02D", text: "#827717", label: "PRO TIP" },
    DEF: { bg: "#E0F2F1", border: "#009688", text: "#004D40", label: "DEFINITION" }
  };
  const theme = colors[type] || colors.TIP;

  doc.moveDown(0.5);
  const startX = doc.x;
  const startY = doc.y;
  const width = 480;

  // Calculate height for text
  doc.font("HumanFont").fontSize(11);
  const textHeight = doc.heightOfString(content || " ", { width: width - 20 }) || 20;
  const rectHeight = Math.max(textHeight + 25, 40);

  if (isNaN(startX) || isNaN(startY) || isNaN(rectHeight)) {
     console.error("[PDF] NaN detected in callout calc:", { startX, startY, rectHeight });
     return;
  }

  // Draw background
  doc.roundedRect(startX, startY, width, rectHeight, 8).fill(theme.bg);
  doc.rect(startX, startY, 4, rectHeight).fill(theme.border); // Simpler left border

  // Draw Label
  doc.fillColor(theme.border).font("HumanFont-Bold").fontSize(9).text(theme.label, startX + 12, startY + 6);
  
  // Draw Content
  doc.fillColor(theme.text).font("HumanFont").fontSize(11).text(content || "", startX + 12, startY + 18, { width: width - 20 });
  
  doc.y = startY + rectHeight + 5;
  doc.moveDown(0.5);
}

function renderSmartContent(doc, text) {
  // Scrub out any raw diagram blocks (Mermaid/D2) so they don't show as text
  const cleanBase = text.replace(/```(mermaid|d2)[\s\S]*??```/g, "").trim();

  // Regex to find [TIP: ...] and [DEF: ...]
  const parts = cleanBase.split(/(\[TIP:.*?\]|\[DEF:.*?\])/g);

  for (const part of parts) {
    if (part.startsWith("[TIP:")) {
      const content = part.replace("[TIP:", "").replace("]", "").trim();
      drawCallout(doc, "TIP", content);
    } else if (part.startsWith("[DEF:")) {
      const content = part.replace("[DEF:", "").replace("]", "").trim();
      drawCallout(doc, "DEF", content);
    } else {
      const cleanText = part.trim();
      if (cleanText) {
        doc.fillColor("#333333").font("HumanFont").fontSize(13).text(cleanText, { 
          lineGap: 4,
          align: 'justify'
        });
        doc.moveDown(0.5);
      }
    }
  }
}

export async function createNotesPdf({ notes, transcript, diagramBuffers, visualImagePaths = [] }) {
  try {
    const tmpDir = getTmpDir();
    await ensureDir(tmpDir);

    const pdfPath = path.join(tmpDir, `${uuidv4()}.pdf`);
    const doc = new PDFDocument({
      size: "A4",
      margin: 54,
      bufferPages: true,
      info: { Title: "StudyAI Premium Notes" }
    });

    await new Promise((resolve, reject) => {
      const stream = fs.createWriteStream(pdfPath);
      doc.pipe(stream);

      const boldFontPath = path.join(__dirname, "..", "fonts", "HumanFont-Bold.ttf");
      const regularFontPath = path.join(__dirname, "..", "fonts", "HumanFont.ttf");
      
      doc.registerFont("HumanFont-Bold", boldFontPath);
      doc.registerFont("HumanFont", regularFontPath);

      // --- PAGE 1: HERO & DASHBOARD ---
      // Background Accent
      doc.rect(0, 0, doc.page.width, 220).fill("#3F51B5");
      
      // Title
      doc.fillColor("#ffffff").font("HumanFont-Bold").fontSize(32).text("LECTURE GUIDE", 54, 50);
      doc.fontSize(14).font("HumanFont").text("AI-POWERED VISUAL CAPTURE", 54, 85);
      
      // Info Badges
      doc.roundedRect(54, 120, 120, 40, 5).fill("#5C6BC0");
      doc.fillColor("#ffffff").fontSize(10).text("TOPIC", 64, 130);
      doc.fontSize(12).font("HumanFont-Bold").text("Class Session", 64, 142);

      doc.roundedRect(190, 120, 120, 40, 5).fill("#5C6BC0");
      doc.fillColor("#ffffff").font("HumanFont").fontSize(10).text("DATE", 200, 130);
      doc.fontSize(12).font("HumanFont-Bold").text(new Date().toLocaleDateString(), 200, 142);

      doc.moveDown(8);
      
      // --- CONTENT SECTION ---
      doc.fillColor("#1A237E").font("HumanFont-Bold").fontSize(22).text("Core Insights", 54, 240);
      doc.rect(54, 268, 50, 4).fill("#3F51B5");
      doc.moveDown(2);

      renderSmartContent(doc, notes || "");

      // --- Visual Insights Section ---
      if (visualImagePaths && visualImagePaths.length > 0) {
        doc.addPage();
        doc.rect(0, 0, doc.page.width, 80).fill("#0097A7"); // Cyan for visuals
        doc.fillColor("#ffffff").font("HumanFont-Bold").fontSize(22).text("Visual Moments", 54, 30);
        doc.moveDown(3);

        for (const imgPath of visualImagePaths) {
           try {
             doc.image(imgPath, {
               fit: [480, 280],
               align: 'center'
             });
             doc.moveDown(0.5);
             doc.font("HumanFont").fontSize(10).fillColor("#666666").text("SCREENCAP ANALYSIS", { align: "center", characterSpacing: 1 });
             doc.moveDown(1.5);
           } catch (e) {
             console.error("[PDF] Image error:", e.message);
           }
        }
      }

      // --- Diagrams Section ---
      if (diagramBuffers && diagramBuffers.length > 0) {
        for (let i = 0; i < diagramBuffers.length; i++) {
          doc.addPage();
          doc.rect(0, 0, doc.page.width, 80).fill("#43A047"); // Green for concepts
          doc.fillColor("#ffffff").font("HumanFont-Bold").fontSize(22).text(`Concept Visual #${i + 1}`, 54, 30);
          doc.moveDown(3);
          
          try {
            doc.image(diagramBuffers[i], {
               fit: [480, 450],
               align: 'center'
            });
          } catch (imgError) {
            console.error("[PDF] Diagram error:", imgError.message);
          }
        }
      }

      // --- Final Transcript ---
      doc.addPage();
      doc.rect(0, 0, doc.page.width, 60).fill("#455A64"); // Blue-gray
      doc.fillColor("#ffffff").font("HumanFont-Bold").fontSize(18).text("Class Transcript", 54, 22);
      doc.moveDown(3);
      doc.fillColor("#555555").font("HumanFont").fontSize(10).text(transcript || "", { lineGap: 1, columns: 2, columnGap: 20 });

      doc.end();
      stream.on("finish", resolve);
      stream.on("error", reject);
    });

    return pdfPath;
  } catch (err) {
    throw Object.assign(new Error(`PDF upgrade error: ${err.message}`), { statusCode: err.statusCode || 500 });
  }
}


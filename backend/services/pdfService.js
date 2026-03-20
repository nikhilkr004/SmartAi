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
  const cleanBase = text.replace(/```(mermaid|d2)[\s\S]*?```/g, "").trim();

  // Regex to find [TIP: ...] and [DEF: ...]
  const parts = cleanBase.split(/(\[TIP:.*?\]|\[DEF:.*?\])/g);

  for (const part of parts) {
    // Pagination Guard: If we are near the bottom (700+ units), start a new page
    if (doc.y > 680) {
      doc.addPage();
    }

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

export async function createNotesPdf({ notes, transcript, diagramBuffers, visualImagePaths = [], topic = "Class Session" }) {
  try {
    const tmpDir = getTmpDir();
    await ensureDir(tmpDir);

    const pdfPath = path.join(tmpDir, `${uuidv4()}.pdf`);
    const doc = new PDFDocument({
      size: "A4",
      margin: 54,
      bufferPages: true,
      info: { Title: `StudyAI Notes - ${topic}` }
    });

    await new Promise((resolve, reject) => {
      const stream = fs.createWriteStream(pdfPath);
      doc.pipe(stream);

      const boldFontPath = path.join(__dirname, "..", "fonts", "HumanFont-Bold.ttf");
      const regularFontPath = path.join(__dirname, "..", "fonts", "HumanFont.ttf");
      
      doc.registerFont("HumanFont-Bold", boldFontPath);
      doc.registerFont("HumanFont", regularFontPath);

      // --- PAGE 1: HERO & DASHBOARD ---
      doc.rect(0, 0, doc.page.width, 240).fill("#3F51B5"); // Taller Hero
      doc.fillColor("#ffffff").font("HumanFont-Bold").fontSize(36).text("LECTURE GUIDE", 54, 50);
      doc.fontSize(16).font("HumanFont").text("AI-POWERED VISUAL CAPTURE", 54, 85);
      
      // Info Badges
      doc.roundedRect(54, 130, 200, 50, 8).fill("#5C6BC0");
      doc.fillColor("#ffffff").fontSize(9).text("TOPIC", 66, 140);
      doc.fontSize(14).font("HumanFont-Bold").text(topic.toUpperCase(), 66, 153, { width: 180, height: 30 });

      doc.roundedRect(268, 130, 100, 50, 8).fill("#5C6BC0");
      doc.fillColor("#ffffff").font("HumanFont").fontSize(9).text("DATE", 280, 140);
      doc.fontSize(14).font("HumanFont-Bold").text(new Date().toLocaleDateString(), 280, 153);

      doc.moveDown(8);
      
      // --- CONTENT SECTION ---
      doc.fillColor("#1A237E").font("HumanFont-Bold").fontSize(24).text("Core Insights", 54, 260);
      doc.rect(54, 292, 60, 5).fill("#3F51B5");
      doc.moveDown(2);

      renderSmartContent(doc, notes || "");

      // --- Visual Moments Section (HERO SIZE) ---
      if (visualImagePaths && visualImagePaths.length > 0) {
        doc.addPage();
        doc.rect(0, 0, doc.page.width, 100).fill("#0097A7"); // Massive Header
        doc.fillColor("#ffffff").font("HumanFont-Bold").fontSize(26).text("Visual Summary", 54, 35);
        doc.moveDown(4);

        for (let i = 0; i < visualImagePaths.length; i++) {
           // New page every 2 hero images (they are bigger now)
           if (i > 0 && i % 2 === 0) {
             doc.addPage();
             doc.rect(0, 0, doc.page.width, 50).fill("#0097A7");
             doc.moveDown(3);
           }
           
           try {
             doc.image(visualImagePaths[i], {
               fit: [520, 300], // Hero size
               align: 'center'
             });
             doc.moveDown(0.5);
             doc.fillColor("#00838F").font("HumanFont-Bold").fontSize(10).text(`SCREEN MOMENT #${i+1}`, { align: "center", underline: true });
             doc.moveDown(1.5);
           } catch (e) {
             console.error("[PDF] Image error:", e.message);
           }
        }
      }

      // --- Diagrams Section (HERO SIZE) ---
      if (diagramBuffers && diagramBuffers.length > 0) {
        doc.addPage();
        doc.rect(0, 0, doc.page.width, 100).fill("#2E7D32"); // Forest Green Hero
        doc.fillColor("#ffffff").font("HumanFont-Bold").fontSize(26).text("Concept Architecture", 54, 35);
        doc.moveDown(4);

        for (let i = 0; i < diagramBuffers.length; i++) {
          // Hero diagrams get 1 per page to look premium
          if (i > 0) {
            doc.addPage();
            doc.rect(0, 0, doc.page.width, 50).fill("#2E7D32");
            doc.moveDown(3);
          }

          try {
            doc.image(diagramBuffers[i], {
               fit: [510, 500], // Max Hero size
               align: 'center',
               valign: 'center'
            });
            doc.moveDown(1);
            doc.fillColor("#1B5E20").font("HumanFont-Bold").fontSize(11).text(`ARCHITECTURE DIAGRAM #${i+1}`, { align: "center" });
          } catch (imgError) {
            console.error("[PDF] Diagram error:", imgError.message);
          }
        }
      }

      // --- Final Transcript ---
      doc.addPage();
      doc.rect(0, 0, doc.page.width, 50).fill("#37474F");
      doc.fillColor("#ffffff").font("HumanFont-Bold").fontSize(18).text("Class Transcript", 54, 16);
      doc.moveDown(2);
      doc.fillColor("#444444").font("HumanFont").fontSize(8).text(transcript || "", { lineGap: 1, columns: 2, columnGap: 24 });

      doc.end();
      stream.on("finish", resolve);
      stream.on("error", reject);
    });

    return pdfPath;
  } catch (err) {
    throw Object.assign(new Error(`PDF upgrade error: ${err.message}`), { statusCode: err.statusCode || 500 });
  }
}


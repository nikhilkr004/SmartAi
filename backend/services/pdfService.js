import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { ensureDir, getTmpDir } from "../utils/fileHelper.js";

function drawRoundedSection(doc, title, body, color = "#0056b3") {
  doc.moveDown(1);
  const startY = doc.y;
  
  // Draw accent line
  doc.lineWidth(3).lineCap('round').moveTo(54, startY).lineTo(54, startY + 20).stroke(color);
  
  doc.fillColor(color).font("HumanFont-Bold").fontSize(18).text(`  ${title}`, 54, startY);
  doc.moveDown(0.5);
  doc.fillColor("#333333").font("HumanFont").fontSize(14).text(body, { 
    lineGap: 4,
    align: 'justify',
    indent: 10
  });
  doc.moveDown(1);
}

export async function createNotesPdf({ notes, transcript, diagramBuffer, visualImagePaths = [] }) {
  try {
    const tmpDir = getTmpDir();
    await ensureDir(tmpDir);

    const pdfPath = path.join(tmpDir, `${uuidv4()}.pdf`);
    const doc = new PDFDocument({
      size: "A4",
      margin: 54,
      bufferPages: true,
      info: { Title: "Smart AI Classroom Notes" }
    });

    await new Promise((resolve, reject) => {
      const stream = fs.createWriteStream(pdfPath);
      doc.pipe(stream);

      const boldFontPath = path.join(__dirname, "..", "fonts", "HumanFont-Bold.ttf");
      const regularFontPath = path.join(__dirname, "..", "fonts", "HumanFont.ttf");
      
      doc.registerFont("HumanFont-Bold", boldFontPath);
      doc.registerFont("HumanFont", regularFontPath);

      // --- Header ---
      doc.rect(0, 0, doc.page.width, 100).fill("#0056b3");
      doc.fillColor("#ffffff").font("HumanFont-Bold").fontSize(28).text("SMART CLASSROOM", 54, 35);
      doc.fontSize(14).text("AI-Powered Visual Study Notes", 54, 65);
      
      doc.moveDown(4);
      doc.fillColor("#000000"); // Reset color

      // --- Notes Section ---
      drawRoundedSection(doc, "Lesson Insights", notes || "");

      // --- Visual Insights (Screenshots) ---
      if (visualImagePaths && visualImagePaths.length > 0) {
        doc.addPage();
        // Header for new page
        doc.rect(0, 0, doc.page.width, 50).fill("#0056b3");
        doc.fillColor("#ffffff").font("HumanFont-Bold").fontSize(18).text("Visual Insights from Recording", 54, 15);
        doc.moveDown(2.5);
        doc.fillColor("#000000");

        for (const imgPath of visualImagePaths) {
           try {
             doc.image(imgPath, {
               fit: [450, 300],
               align: 'center'
             });
             doc.moveDown(1);
             doc.font("HumanFont").fontSize(10).fillColor("#666666").text("Captured from screen recording", { align: "center" });
             doc.moveDown(2);
             doc.fillColor("#000000");
           } catch (e) {
             console.error("[PDF] Error embedding screenshot:", e.message);
           }
        }
      }

      // --- Mermaid Diagrams ---
      if (diagramBuffers && diagramBuffers.length > 0) {
        for (let i = 0; i < diagramBuffers.length; i++) {
          doc.addPage();
          doc.rect(0, 0, doc.page.width, 50).fill("#28a745"); // Green for diagrams
          doc.fillColor("#ffffff").font("HumanFont-Bold").fontSize(18).text(`Concept Visual #${i + 1}`, 54, 15);
          doc.moveDown(3);
          
          try {
            doc.image(diagramBuffers[i], {
               fit: [480, 500],
               align: 'center'
            });
          } catch (imgError) {
            console.error("[PDF] Failed to embed Mermaid image:", imgError.message);
          }
        }
      }

      // --- Transcript ---
      doc.addPage();
      doc.rect(0, 0, doc.page.width, 50).fill("#6c757d"); // Gray for transcript
      doc.fillColor("#ffffff").font("HumanFont-Bold").fontSize(18).text("Original Transcript", 54, 15);
      doc.moveDown(3);
      doc.fillColor("#333333").font("HumanFont").fontSize(12).text(transcript || "", { lineGap: 2 });

      doc.end();
      stream.on("finish", resolve);
      stream.on("error", reject);
    });

    return pdfPath;
  } catch (err) {
    throw Object.assign(new Error(`PDF generation error: ${err.message}`), { statusCode: err.statusCode || 500 });
  }
}


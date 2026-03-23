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
      // Main Heading - Magazine Style
      doc.moveDown(2);
      if (doc.y > 600) doc.addPage();
      const heading = line.replace("# ", "").toUpperCase();
      
      const startY = doc.y;
      doc.rect(54, startY - 10, 3, 30).fill("#1B263B"); // Accent bar
      doc.fillColor("#0D1B2A").font("HeadingFont").fontSize(20).text(heading, 65, startY);
      doc.moveDown(1.2);
    } else if (line.startsWith("## ")) {
      // Sub Heading - Clean & Modern
      doc.moveDown(1.2);
      if (doc.y > 700) doc.addPage();
      const subHeading = line.replace("## ", "");
      doc.fillColor("#415A77").font("HeadingFont").fontSize(15).text(subHeading.toUpperCase());
      doc.rect(doc.x, doc.y + 2, 30, 1.5).fill("#778DA9");
      doc.moveDown(0.8);
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

export async function createNotesPdf({ notes, transcript, diagramBuffers, chartBuffers = [], visualImagePaths = [], topic = "Class Session", isPro = false, userName = "Student" }) {
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

      // --- Custom Background & Global Header ---
      const drawPageBackground = () => {
        doc.rect(0, 0, doc.page.width, doc.page.height).fill("#FAF9F6");
        
        // Subtle Dot Grid
        doc.fillColor("#E0E0E0");
        for (let x = 40; x < doc.page.width; x += 20) {
          for (let y = 40; y < doc.page.height; y += 20) {
            doc.circle(x, y, 0.5).fill();
          }
        }

        // Global Page Header (Except first page)
        if (doc.page.number > 1) {
          doc.fillColor("#90A4AE").font("HeadingFont").fontSize(7).text("STUDYAI ACADEMIC SERIES", 400, 30, { align: "right" });
        }
      };

      doc.on('pageAdded', drawPageBackground);
      drawPageBackground();

      // --- PAGE 1: PREMIUM HERO ---
      // Modern Dark Header
      doc.rect(0, 0, doc.page.width, 220).fill("#0D1B2A"); 
      
      // Pro Badge
      if (isPro) {
        doc.fillColor("#E0E1DD").font("HeadingFont").fontSize(9).text("AERO PRO EDITION", 60, 45);
        doc.rect(60, 58, 100, 1.5).fill("#E0E1DD");
      }
      
      doc.fillColor("#ffffff").font("HeadingFont").fontSize(38).text("STUDY NOTES", 60, 75);
      doc.fontSize(16).font("BodyFont").fillColor("#778DA9").text("MASTERCLASS SERIES", 60, 115);
      
      // Topic Badge (Glassmorphism look)
      doc.roundedRect(60, 145, 300, 45, 6).fill("#1B263B");
      doc.fillColor("#778DA9").font("HeadingFont").fontSize(9).text("TOPIC PERSPECTIVE", 75, 155);
      doc.fillColor("#ffffff").fontSize(13).text(topic.toUpperCase(), 75, 168, { width: 270, ellipsis: true });

      // Side Detail (Right)
      doc.fillColor("#415A77").font("BodyFont").fontSize(8).text("AUTHOR / STUDENT", 450, 45, { align: "right" });
      doc.fillColor("#ffffff").font("HeadingFont").fontSize(11).text(userName, 450, 58, { align: "right" });
      
      const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      doc.fillColor("#415A77").font("BodyFont").fontSize(8).text("GENERATED ON", 450, 85, { align: "right" });
      doc.fillColor("#ffffff").font("HeadingFont").fontSize(11).text(dateStr, 450, 98, { align: "right" });

      // Student Copy Badge
      doc.rect(480, 145, 100, 20).fill("#1B263B");
      doc.fillColor("#778DA9").font("HeadingFont").fontSize(7).text("OFFICIAL STUDENT COPY", 485, 152, { align: "right", width: 90 });

      doc.y = 260;
      
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


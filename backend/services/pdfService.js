import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { ensureDir, getTmpDir } from "../utils/fileHelper.js";

function addSection(doc, title, body) {
  doc.moveDown(0.5);
  doc.font("HumanFont-Bold").fontSize(16).text(title);
  doc.moveDown(0.3);
  doc.font("HumanFont").fontSize(14).text(body, { lineGap: 4 });
}

export async function createNotesPdf({ notes, transcript }) {
  try {
    const tmpDir = getTmpDir();
    await ensureDir(tmpDir);

    const pdfPath = path.join(tmpDir, `${uuidv4()}.pdf`);
    const doc = new PDFDocument({
      size: "A4",
      margin: 54,
      info: {
        Title: "Smart Classroom Notes"
      }
    });

    await new Promise((resolve, reject) => {
      const stream = fs.createWriteStream(pdfPath);
      doc.pipe(stream);

      const boldFontPath = path.join(__dirname, "..", "fonts", "HumanFont-Bold.ttf");
      const regularFontPath = path.join(__dirname, "..", "fonts", "HumanFont.ttf");
      
      doc.registerFont("HumanFont-Bold", boldFontPath);
      doc.registerFont("HumanFont", regularFontPath);

      doc.font("HumanFont-Bold").fontSize(26).text("Smart Classroom Assistant Notes", { align: "center" });
      doc.moveDown(1);

      addSection(doc, "Notes", notes || "");
      doc.addPage();
      addSection(doc, "Transcript", transcript || "");

      doc.end();
      stream.on("finish", resolve);
      stream.on("error", reject);
    });

    return pdfPath;
  } catch (err) {
    throw Object.assign(new Error(`PDF generation error: ${err.message}`), { statusCode: err.statusCode || 500 });
  }
}


import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

import { ensureDir, getTmpDir } from "../utils/fileHelper.js";

function addSection(doc, title, body) {
  doc.moveDown(0.5);
  doc.font("Helvetica-Bold").fontSize(14).text(title);
  doc.moveDown(0.3);
  doc.font("Helvetica").fontSize(11).text(body, { lineGap: 3 });
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

      doc.font("Helvetica-Bold").fontSize(20).text("Smart Classroom Assistant Notes", { align: "center" });
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


import path from "path";
import { v4 as uuidv4 } from "uuid";

import { initFirebase } from "../config/firebase.js";

export async function uploadPdfForUser({ userId, pdfPath }) {
  try {
    const admin = await initFirebase();
    const bucket = admin.storage().bucket();

    const objectName = `users/${userId}/${uuidv4()}.pdf`;

    await bucket.upload(pdfPath, {
      destination: objectName,
      metadata: {
        contentType: "application/pdf",
        cacheControl: "public, max-age=31536000"
      }
    });

    const file = bucket.file(objectName);

    // Prefer a long-lived signed URL to avoid requiring bucket-wide public ACLs.
    const [signedUrl] = await file.getSignedUrl({
      action: "read",
      expires: "2100-01-01T00:00:00Z"
    });

    return signedUrl;
  } catch (err) {
    throw Object.assign(new Error(`Firebase upload error: ${err.message}`), { statusCode: err.statusCode || 502 });
  }
}


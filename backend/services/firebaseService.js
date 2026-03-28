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

export async function uploadRecordingForUser({ userId, recordingPath }) {
  try {
    const admin = await initFirebase();
    const bucket = admin.storage().bucket();

    const objectName = `users/${userId}/${uuidv4()}.mp4`;

    await bucket.upload(recordingPath, {
      destination: objectName,
      metadata: {
        contentType: "video/mp4",
        cacheControl: "public, max-age=31536000"
      }
    });

    const file = bucket.file(objectName);

    const [signedUrl] = await file.getSignedUrl({
      action: "read",
      expires: "2100-01-01T00:00:00Z"
    });

    return signedUrl;
  } catch (err) {
    throw Object.assign(new Error(`Firebase upload error: ${err.message}`), { statusCode: err.statusCode || 502 });
  }
}


export async function getUserData(userId) {
  try {
    const admin = await initFirebase();
    const db = admin.firestore();
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) return null;
    return userDoc.data();
  } catch (err) {
    console.error(`[FIREBASE] Error fetching user ${userId}:`, err);
    return null;
  }
}

export async function getUserRecordingCount(userId) {
  try {
    const admin = await initFirebase();
    const db = admin.firestore();
    const snap = await db.collection("recordings")
      .where("userId", "==", userId)
      .get();
    return snap.size;
  } catch (err) {
    console.error(`[FIREBASE] Error counting recordings for ${userId}:`, err);
    return 0;
  }
}
export async function updateJobStatus(jobId, data) {
  try {
    const admin = await initFirebase();
    const db = admin.firestore();
    await db.collection("processing_jobs").doc(jobId).set({
      ...data,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    console.log(`[FIREBASE] Job ${jobId} updated: ${data.status}`);
  } catch (err) {
    console.error(`[FIREBASE] Error updating job ${jobId}:`, err);
  }
}
export async function downloadFileFromStorage(storagePath, localPath) {
  try {
    const admin = await initFirebase();
    const bucket = admin.storage().bucket();
    
    // If it's a full URL, we might need to extract the path, 
    // but better to have the client send the storage path directly.
    await bucket.file(storagePath).download({ destination: localPath });
    console.log(`[FIREBASE] Downloaded ${storagePath} to ${localPath}`);
  } catch (err) {
    console.error(`[FIREBASE] Download failed for ${storagePath}:`, err);
    throw new Error(`Firebase download error: ${err.message}`);
  }
}

import { initFirebase } from "../config/firebase.js";

/**
 * Middleware to verify Firebase ID Token in the Authorization header.
 */
export async function verifyAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: { message: "Unauthorized: Missing or invalid token format" } });
  }

  const idToken = authHeader.split(" ")[1];

  try {
    const admin = await initFirebase();
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    // Attach user info to request
    req.user = decodedToken;
    next();
  } catch (err) {
    console.error("Auth verification failed:", err.message);
    return res.status(401).json({ error: { message: "Unauthorized: Invalid or expired token" } });
  }
}

/**
 * Fetches a rendered D2 diagram image from Kroki.
 * @param {string} d2Code - The raw D2 syntax string.
 * @returns {Promise<Buffer|null>} - The binary image buffer, or null if it fails.
 */
export async function generateD2Image(d2Code) {
  const cleanCode = d2Code
    .replace(/```d2/g, "")
    .replace(/```/g, "")
    .trim();

  if (!cleanCode) return null;

  try {
    console.log("[D2] Requesting diagram image from Kroki...");
    // Kroki D2 endpoint
    const response = await axios.post("https://kroki.io/d2/png", cleanCode, {
      headers: { 'Content-Type': 'text/plain' },
      responseType: "arraybuffer",
      timeout: 10000
    });
    
    console.log("[D2] Successfully generated D2 image!");
    return Buffer.from(response.data);
  } catch (error) {
    console.error("[D2 ERROR] Rendering failed:", error.message);
    return null;
  }
}

// Keep the old one for backward compatibility if needed, but we'll use D2 primarily now.
export async function generateMermaidImage(mermaidCode) {
  // Existing mermaid logic...
}

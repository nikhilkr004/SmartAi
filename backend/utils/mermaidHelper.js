import axios from "axios";

/**
 * Fetches a rendered D2 diagram image from Kroki.
 * @param {string} d2Code - The raw D2 syntax string.
 * @returns {Promise<Buffer|null>} - The binary image buffer, or null if it fails.
 */
export async function generateD2Image(d2Code) {
  if (!d2Code) return null;
  const cleanCode = d2Code
    .replace(/```d2/g, "")
    .replace(/```/g, "")
    .trim();

  if (!cleanCode) return null;

  try {
    console.log("[D2] Requesting diagram image from Kroki...");
    const response = await axios.post("https://kroki.io/d2/png", cleanCode, {
      headers: { 'Content-Type': 'text/plain' },
      responseType: "arraybuffer",
      timeout: 15000
    });
    
    console.log("[D2] Successfully generated D2 image!");
    return Buffer.from(response.data);
  } catch (error) {
    console.error("[D2 ERROR] Rendering failed:", error.response?.status || error.message);
    return null;
  }
}

/**
 * Fetches a rendered Mermaid diagram image with multiple fallbacks.
 * @param {string} mermaidCode - The raw Mermaid syntax string.
 * @returns {Promise<Buffer|null>} - The binary image buffer, or null if it fails.
 */
export async function generateMermaidImage(mermaidCode) {
  if (!mermaidCode) return null;
  const cleanCode = mermaidCode
    .replace(/```mermaid/g, "")
    .replace(/```/g, "")
    .trim();

  if (!cleanCode) return null;

  try {
    console.log("[MERMAID] Requesting diagram image from Primary (QuickChart)...");
    const qcUrl = `https://quickchart.io/mermaid?graph=${encodeURIComponent(cleanCode)}&width=800`;
    const response = await axios.get(qcUrl, { responseType: "arraybuffer", timeout: 8000 });
    return Buffer.from(response.data);
  } catch (error) {
    console.warn("[MERMAID] Primary failed, trying Fallback (Kroki)...", error.message);
    
    try {
      const krokiResponse = await axios.post("https://kroki.io/mermaid/png", cleanCode, {
        headers: { 'Content-Type': 'text/plain' },
        responseType: "arraybuffer",
        timeout: 10000
      });
      return Buffer.from(krokiResponse.data);
    } catch (fallbackError) {
      try {
        const b64 = Buffer.from(cleanCode).toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');
        const inkUrl = `https://mermaid.ink/img/${b64}`;
        const inkResponse = await axios.get(inkUrl, { responseType: "arraybuffer", timeout: 10000 });
        return Buffer.from(inkResponse.data);
      } catch (inkError) {
        console.error("[MERMAID ERROR] All fallbacks failed.");
        return null;
      }
    }
  }
}

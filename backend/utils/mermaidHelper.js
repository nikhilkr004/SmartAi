import axios from "axios";

/**
 * Fetches a rendered Mermaid diagram image from QuickChart (Highly Stable).
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
    console.log("[MERMAID] Requesting diagram image via POST (Kroki)...");
    // POST is much more reliable for long diagrams as it avoids URL length limits
    const response = await axios.post("https://kroki.io/mermaid/png", cleanCode, {
      headers: { 'Content-Type': 'text/plain' },
      responseType: "arraybuffer",
      timeout: 15000
    });
    
    console.log("[MERMAID] Successfully generated image via POST!");
    return Buffer.from(response.data);
  } catch (error) {
    console.warn("[MERMAID] POST failed, trying QuickChart GET fallback...", error.message);
    
    try {
      const url = `https://quickchart.io/mermaid?graph=${encodeURIComponent(cleanCode)}&width=800`;
      const response = await axios.get(url, { responseType: "arraybuffer", timeout: 10000 });
      return Buffer.from(response.data);
    } catch (fallbackError) {
      console.error("[MERMAID ERROR] All diagram fallbacks failed.");
      return null;
    }
  }
}

/**
 * Legacy support for D2 call (now aliases to Mermaid for stability)
 */
export async function generateD2Image(code) {
  console.log("[D2/STABLE] Routing D2-style request to Mermaid for stability...");
  return generateMermaidImage(code);
}

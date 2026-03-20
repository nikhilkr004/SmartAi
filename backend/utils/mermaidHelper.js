import axios from "axios";

/**
 * Fetches a rendered Mermaid diagram image from QuickChart (Highly Stable).
 * @param {string} mermaidCode - The raw Mermaid syntax string.
 * @returns {Promise<Buffer|null>} - The binary image buffer, or null if it fails.
 */
export async function generateMermaidImage(mermaidCode) {
  if (!mermaidCode) return null;
  // CLEANER: Remove markdown fences and trim
  let cleanCode = mermaidCode
    .replace(/```mermaid/g, "")
    .replace(/```/g, "")
    .trim();

  // AUTO-FIXER: Fix common AI mistakes
  cleanCode = cleanCode
    .split('\n')
    .map(line => {
      // 1. Force '->' to '-->' (More stable in Mermaid)
      if (line.includes('->') && !line.includes('-->')) {
        return line.replace(/->/g, '-->');
      }
      return line;
    })
    .filter(line => !line.trim().startsWith('%%')) // Remove comments
    .join('\n');

  if (!cleanCode) return null;

  try {
    console.log("[MERMAID] Requesting diagram image via POST (Kroki)...");
    const response = await axios.post("https://kroki.io/mermaid/png", cleanCode, {
      headers: { 'Content-Type': 'text/plain' },
      responseType: "arraybuffer",
      timeout: 15000
    });
    
    console.log("[MERMAID] Successfully generated image!");
    return Buffer.from(response.data);
  } catch (error) {
    console.warn("[MERMAID ERROR] Rendering failed. Status:", error.response?.status);
    console.warn("[MERMAID DEBUG] Code that failed:\n", cleanCode);
    
    try {
      // Fallback to simpler QuickChart GET
      const url = `https://quickchart.io/mermaid?graph=${encodeURIComponent(cleanCode)}&width=800`;
      const response = await axios.get(url, { responseType: "arraybuffer", timeout: 10000 });
      return Buffer.from(response.data);
    } catch (fallbackError) {
      console.error("[MERMAID ERROR] All fallbacks failed.");
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

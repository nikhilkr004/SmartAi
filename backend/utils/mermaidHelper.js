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
    console.log("[MERMAID] Requesting diagram image from QuickChart...");
    // QuickChart is very robust for standard Mermaid
    const url = `https://quickchart.io/mermaid?graph=${encodeURIComponent(cleanCode)}&width=800`;
    
    const response = await axios.get(url, { responseType: "arraybuffer", timeout: 12000 });
    console.log("[MERMAID] Successfully generated image!");
    return Buffer.from(response.data);
  } catch (error) {
    console.warn("[MERMAID] QuickChart failed, trying Mermaid.ink fallback...", error.message);
    
    try {
      const b64 = Buffer.from(cleanCode).toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      const inkUrl = `https://mermaid.ink/img/${b64}`;
      const inkResponse = await axios.get(inkUrl, { responseType: "arraybuffer", timeout: 10000 });
      return Buffer.from(inkResponse.data);
    } catch (inkError) {
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

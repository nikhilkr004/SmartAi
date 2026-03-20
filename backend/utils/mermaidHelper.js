import axios from "axios";

/**
 * Fetches a rendered Mermaid diagram image from QuickChart.
 * @param {string} mermaidCode - The raw Mermaid syntax string.
 * @returns {Promise<Buffer|null>} - The binary image buffer of the generated chart, or null if it fails.
 */
export async function generateMermaidImage(mermaidCode) {
  if (!mermaidCode || mermaidCode.trim() === "") return null;

  try {
    console.log("[MERMAID] Requesting diagram image from Primary (QuickChart)...");
    const qcUrl = `https://quickchart.io/mermaid?graph=${encodeURIComponent(mermaidCode)}&width=800`;
    const response = await axios.get(qcUrl, { responseType: "arraybuffer", timeout: 8000 });
    
    console.log("[MERMAID] Successfully generated diagram image!");
    return Buffer.from(response.data);
  } catch (error) {
    console.warn("[MERMAID] Primary renderer failed, trying Fallback (Kroki)...", error.message);
    
    try {
      // Fallback 1: Kroki POST
      console.log("[MERMAID] Trying Fallback 1 (Kroki)...");
      const krokiResponse = await axios.post("https://kroki.io/mermaid/png", mermaidCode, {
        headers: { 'Content-Type': 'text/plain' },
        responseType: "arraybuffer",
        timeout: 10000
      });
      console.log("[MERMAID] Kroki fallback successful!");
      return Buffer.from(krokiResponse.data);
    } catch (fallbackError) {
      console.warn("[MERMAID] Kroki failed, trying Fallback 2 (Mermaid.ink)...", fallbackError.message);
      
      try {
        // Fallback 2: Mermaid.ink (Base64)
        const b64 = Buffer.from(mermaidCode).toString('base64');
        const inkUrl = `https://mermaid.ink/img/${b64}`;
        const inkResponse = await axios.get(inkUrl, { responseType: "arraybuffer", timeout: 10000 });
        console.log("[MERMAID] Mermaid.ink fallback successful!");
        return Buffer.from(inkResponse.data);
      } catch (inkError) {
        console.error("[MERMAID ERROR] All rendering attempts failed:", inkError.message);
        return null;
      }
    }
  }
}

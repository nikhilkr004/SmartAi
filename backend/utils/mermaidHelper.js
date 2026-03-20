import axios from "axios";

/**
 * Fetches a rendered Mermaid diagram image from QuickChart.
 * @param {string} mermaidCode - The raw Mermaid syntax string.
 * @returns {Promise<Buffer|null>} - The binary image buffer of the generated chart, or null if it fails.
 */
export async function generateMermaidImage(mermaidCode) {
  // Clean the mermaid code: remove fences and trim
  const cleanCode = mermaidCode
    .replace(/```mermaid/g, "")
    .replace(/```/g, "")
    .trim();

  if (!cleanCode) return null;

  try {
    console.log("[MERMAID] Requesting diagram image from Primary (QuickChart)...");
    const qcUrl = `https://quickchart.io/mermaid?graph=${encodeURIComponent(cleanCode)}&width=800`;
    const response = await axios.get(qcUrl, { responseType: "arraybuffer", timeout: 8000 });
    
    console.log("[MERMAID] Successfully generated diagram image!");
    return Buffer.from(response.data);
  } catch (error) {
    console.warn("[MERMAID] Primary renderer failed, trying Fallback (Kroki)...", error.message);
    
    try {
      // Fallback 1: Kroki GET (Most stable)
      console.log("[MERMAID] Trying Fallback 1 (Kroki GET)...");
      // Kroki prefers Base64 but specialized for their API. Let's try simple POST first again but with better error handling.
      const krokiResponse = await axios.post("https://kroki.io/mermaid/png", cleanCode, {
        headers: { 'Content-Type': 'text/plain' },
        responseType: "arraybuffer",
        timeout: 10000
      });
      console.log("[MERMAID] Kroki fallback successful!");
      return Buffer.from(krokiResponse.data);
    } catch (fallbackError) {
      console.warn("[MERMAID] Kroki failed, trying Fallback 2 (Mermaid.ink)...", fallbackError.message);
      
      try {
        // Fallback 2: Mermaid.ink (URL-safe Base64)
        const b64 = Buffer.from(cleanCode).toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');
        const inkUrl = `https://mermaid.ink/img/${b64}`;
        console.log("[MERMAID] Calling Mermaid.ink:", inkUrl);
        const inkResponse = await axios.get(inkUrl, { responseType: "arraybuffer", timeout: 10000 });
        console.log("[MERMAID] Mermaid.ink fallback successful!");
        return Buffer.from(inkResponse.data);
      } catch (inkError) {
        console.error("[MERMAID ERROR] All rendering attempts failed, status of last:", inkError.response?.status || inkError.message);
        return null;
      }
    }
  }
}

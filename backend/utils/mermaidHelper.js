import axios from "axios";

/**
 * Fetches a rendered Mermaid diagram image from QuickChart (Highly Stable).
 * @param {string} mermaidCode - The raw Mermaid syntax string.
 * @returns {Promise<Buffer|null>} - The binary image buffer, or null if it fails.
 */
export async function generateMermaidImage(mermaidCode) {
  if (!mermaidCode) return null;
  let cleanCode = mermaidCode
    .replace(/```mermaid/g, "")
    .replace(/```/g, "")
    .trim();

  // NUCLEAR SANITIZER: Fix labels that break Mermaid
  cleanCode = cleanCode
    .split('\n')
    .map(line => {
      let l = line;
      // 1. Fix Arrows: '->' to '-->'
      if (l.includes('->') && !l.includes('-->')) {
        l = l.replace(/->/g, '-->');
      }
      
      // 2. Wrap [label] in ["label"] and strip internal quotes/special chars
      // This fixes A[Message: "Hello"] -> A["Message: Hello"]
      l = l.replace(/\[(.*?)\]/g, (match, p1) => {
        const safe = p1.replace(/["'?;()]/g, '').trim();
        return `["${safe}"]`;
      });

      // 3. Wrap {label} in {"label"}
      l = l.replace(/\{(.*?)\}/g, (match, p1) => {
        const safe = p1.replace(/["'?;()]/g, '').trim();
        return `{"${safe}"}`;
      });

      // 4. Wrap (label) in ("label")
      l = l.replace(/\((.*?)\)/g, (match, p1) => {
        if (p1.includes('graph ') || p1.includes('flowchart ')) return match; // Skip header
        const safe = p1.replace(/["'?;()]/g, '').trim();
        return `("${safe}")`;
      });

      return l;
    })
    .filter(line => !line.trim().startsWith('%%'))
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
    console.warn("[MERMAID DEBUG] Code SENT to server:\n", cleanCode);
    
    try {
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

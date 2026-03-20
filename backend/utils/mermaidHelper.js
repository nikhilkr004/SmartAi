import axios from "axios";
import zlib from "zlib";

/**
 * Standard Kroki encoding: Zlib Deflate -> Base64 -> URL Safe
 */
function encodeKroki(content) {
  const buffer = Buffer.from(content, 'utf8');
  const compressed = zlib.deflateSync(buffer, { level: 9 });
  return compressed.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Fetches a rendered D2 diagram image from Kroki.
 */
export async function generateD2Image(d2Code) {
  if (!d2Code) return null;
  const cleanCode = d2Code
    .replace(/```d2/g, "")
    .replace(/```/g, "")
    .trim();

  if (!cleanCode) return null;

  // --- AUTOMATED D2 SANITIZATION ---
  const sanitizedCode = cleanCode.split('\n').map(line => {
    // Only wrap in quotes if there are spaces and no quotes already
    if (line.includes('->') && !line.includes('"')) {
      return line.split('->').map(part => `"${part.trim()}"`).join(' -> ');
    }
    return line;
  }).join('\n');

  try {
    const encoded = encodeKroki(sanitizedCode);
    const url = `https://kroki.io/d2/svg/${encoded}`;
    
    console.log("[D2] Requesting diagram image from Kroki (GET/Zlib)...");
    const response = await axios.get(url, { responseType: "arraybuffer", timeout: 15000 });
    
    console.log("[D2] Successfully generated D2 image!");
    return Buffer.from(response.data);
  } catch (error) {
    console.error("[D2 ERROR] Rendering failed:", error.response?.status || error.message);
    return null;
  }
}

/**
 * Fetches a rendered Mermaid diagram image with multiple fallbacks.
 */
export async function generateMermaidImage(mermaidCode) {
  if (!mermaidCode) return null;
  const cleanCode = mermaidCode
    .replace(/```mermaid/g, "")
    .replace(/```/g, "")
    .trim();

  if (!cleanCode) return null;

  try {
    const encoded = encodeKroki(cleanCode);
    const url = `https://kroki.io/mermaid/svg/${encoded}`;
    
    console.log("[MERMAID] Requesting diagram image from Kroki (GET/Zlib)...");
    const response = await axios.get(url, { responseType: "arraybuffer", timeout: 10000 });
    return Buffer.from(response.data);
  } catch (error) {
    console.warn("[MERMAID] Kroki failed, trying QuickChart fallback...", error.message);
    
    try {
      const qcUrl = `https://quickchart.io/mermaid?graph=${encodeURIComponent(cleanCode)}&width=800`;
      const response = await axios.get(qcUrl, { responseType: "arraybuffer", timeout: 8000 });
      return Buffer.from(response.data);
    } catch (fallbackError) {
      console.error("[MERMAID ERROR] All fallbacks failed.");
      return null;
    }
  }
}

import axios from "axios";

/**
 * Fetches a rendered Mermaid diagram image from QuickChart or Kroki.
 * @param {string} mermaidCode - The raw Mermaid syntax string.
 * @returns {Promise<Buffer|null>} - The binary image buffer, or null if it fails.
 */
export async function generateMermaidImage(mermaidCode) {
  if (!mermaidCode) return null;
  let cleanCode = mermaidCode
    .replace(/```mermaid/g, "")
    .replace(/```/g, "")
    .trim();

  // NUCLEAR SANITIZER: Split by connectors, clean nodes precisely, re-join.
  const processedCode = cleanCode
    .split('\n')
    .map(line => {
      let l = line.trim();
      if (!l || l.toLowerCase().startsWith('graph') || l.toLowerCase().startsWith('flowchart')) {
        return l;
      }

      // Split line into nodes and connectors
      const parts = l.split(/(\s*--?>\s*|\s*---?\s*|\s*==?>\s*|\s*-\.\s*)/);
      const cleanedParts = parts.map(p => {
        if (!p) return p;
        
        // If it looks like a connector, standardize and return
        if (p.trim().match(/^(--?>|---?|==?>|-\.)$/)) {
          let c = p.trim();
          if (c === '->') return ' --> ';
          if (c === '-->') return ' --> ';
          if (c === '==>') return ' ==> ';
          return ` ${c} `;
        }
        
        // If it's a node, find the outermost brackets and clean the label
        const shapes = [
          { open: '[', close: ']' },
          { open: '{', close: '}' },
          { open: '(', close: ')' },
          { open: '>', close: ']' }
        ];

        let bestShape = null;
        let minStart = Infinity;

        for (const s of shapes) {
          const start = p.indexOf(s.open);
          const end = p.lastIndexOf(s.close);
          if (start !== -1 && end !== -1 && end > start) {
            if (start < minStart) {
              minStart = start;
              bestShape = { ...s, start, end };
            }
          }
        }

        if (bestShape) {
          const { open, close, start, end } = bestShape;
          const id = p.substring(0, start).trim();
          const content = p.substring(start + 1, end).trim();
          // Strip quotes and internal brackets that break Mermaid
          const safeContent = content.replace(/["'\[\]\(\)\{\}]/g, '').trim();
          return `${id}${open}"${safeContent}"${close}`;
        }
        
        return p; // Return as-is if no shape found
      });
      
      return cleanedParts.join('');
    })
    .filter(line => !!line)
    .join('\n');

  cleanCode = processedCode;

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

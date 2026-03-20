import axios from "axios";

/**
 * Fetches a rendered Mermaid diagram image from QuickChart.
 * @param {string} mermaidCode - The raw Mermaid syntax string.
 * @returns {Promise<Buffer|null>} - The binary image buffer of the generated chart, or null if it fails.
 */
export async function generateMermaidImage(mermaidCode) {
  if (!mermaidCode || mermaidCode.trim() === "") return null;

  try {
    console.log("[MERMAID] Requesting diagram image...");
    
    // Using a very robust encoding for QuickChart
    const url = `https://quickchart.io/mermaid?graph=${encodeURIComponent(mermaidCode)}&width=800`;

    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 20000 
    });

    console.log("[MERMAID] Successfully generated diagram image!");
    return Buffer.from(response.data);
  } catch (error) {
    console.error("[MERMAID ERROR] Failed to generate image:", error.message);
    return null; 
  }
}

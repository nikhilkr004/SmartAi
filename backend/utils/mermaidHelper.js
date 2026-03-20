import axios from "axios";

/**
 * Sends Mermaid code to QuickChart API and returns the rendered image buffer.
 * @param {string} mermaidCode - The raw Mermaid syntax string.
 * @returns {Promise<Buffer|null>} - The binary image buffer of the generated chart, or null if it fails.
 */
export async function generateMermaidImage(mermaidCode) {
  if (!mermaidCode || mermaidCode.trim() === "") return null;

  try {
    console.log("[MERMAID] Requesting diagram image from quickchart.io...");
    const payload = {
      graph: mermaidCode,
      backgroundColor: "white", // Better for PDF than transparent
    };

    const response = await axios.post("https://quickchart.io/mermaid", payload, {
      responseType: "arraybuffer",
      timeout: 10000 // 10 second timeout
    });

    console.log("[MERMAID] Successfully generated diagram image!");
    return Buffer.from(response.data);
  } catch (error) {
    console.error("[MERMAID ERROR] Failed to generate image from quickchart:", error.message);
    if (error.response && error.response.data) {
      console.error("[MERMAID ERROR DETAILS]:", Buffer.from(error.response.data).toString('utf8'));
    }
    return null; // Gracefully fail without crashing the whole application
  }
}

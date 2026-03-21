import { createNotesPdf } from "../backend/services/pdfService.js";
import { generateChartImage } from "../backend/utils/chartHelper.js";
import { generateMermaidImage } from "../backend/utils/mermaidHelper.js";
import fs from "fs";
import path from "path";

async function verifyFullSystem() {
  console.log("--- Starting Full System Verification ---");

  const mockNotes = `
# HEALTH CHECK SESSION
This is a mock session to verify the new Chart.js and Mermaid integration.

## Concept 1: The Loop
[DEF: Loop - A repetitive process]
[TIP: Use while for unknown iterations]

## Data Analysis
The student's scores improved significantly over the last 3 weeks.

\`\`\`chartjs
{
  "type": "line",
  "data": {
    "labels": ["Week 1", "Week 2", "Week 3"],
    "datasets": [{
      "label": "Score",
      "data": [45, 78, 95],
      "borderColor": "blue",
      "fill": false
    }]
  },
  "options": {
    "plugins": {
      "title": { "display": true, "text": "Learning Progress" }
    }
  }
}
\`\`\`

## Architecture
\`\`\`mermaid
graph TD
  A[Input] --> B[Processing]
  B --> C[PDF Output]
\`\`\`

# MASTERCLASS CHEAT SHEET
- Focus on consistency.
`;

  console.log("1. Testing Mermaid Generation...");
  const mermaidBuffer = await generateMermaidImage("graph TD\nA-->B");
  if (mermaidBuffer) console.log("✅ Mermaid OK"); else console.error("❌ Mermaid Failed");

  console.log("2. Testing Chart.js Generation...");
  const chartConfig = {
    type: 'bar',
    data: { labels: ['A', 'B'], datasets: [{ label: 'Test', data: [1, 2] }] }
  };
  const chartBuffer = await generateChartImage(chartConfig);
  if (chartBuffer) console.log("✅ Chart.js OK"); else console.error("❌ Chart.js Failed");

  console.log("3. Testing PDF Rendering...");
  const pdfPath = await createNotesPdf({
    notes: mockNotes,
    transcript: "This is a test transcript.",
    diagramBuffers: [mermaidBuffer],
    chartBuffers: [chartBuffer],
    topic: "SYSTEM VERIFICATION",
    isPro: true
  });

  if (fs.existsSync(pdfPath)) {
    console.log(`✅ PDF Generated at: ${pdfPath}`);
    // Copy to a known location for the user to see if they want
    const finalPath = path.join(process.cwd(), "verification_result.pdf");
    fs.copyFileSync(pdfPath, finalPath);
    console.log(`✅ Copy saved to: ${finalPath}`);
  } else {
    console.error("❌ PDF Generation Failed");
  }

  console.log("--- Verification Complete ---");
}

verifyFullSystem().catch(console.error);

import { generateChartImage } from "../backend/utils/chartHelper.js";
import fs from "fs";
import path from "path";

async function test() {
  const config = {
    type: 'bar',
    data: {
      labels: ['Topic A', 'Topic B', 'Topic C'],
      datasets: [{
        label: 'Understanding Level',
        data: [85, 92, 78]
      }]
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: 'Masterclass Concept Mastery'
        }
      }
    }
  };

  const buffer = await generateChartImage(config);
  if (buffer) {
    fs.writeFileSync("test_chart.png", buffer);
    console.log("Success! Chart saved to test_chart.png");
  } else {
    console.error("Failed to generate chart.");
  }
}

test();

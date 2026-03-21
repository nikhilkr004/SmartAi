import axios from "axios";

/**
 * Premium Colors for Chart.js (Masterclass Theme)
 */
const PREMIUM_COLORS = [
  'rgba(25, 118, 210, 0.8)',   // Deep Blue
  'rgba(56, 142, 60, 0.8)',   // Green
  'rgba(211, 47, 47, 0.8)',   // Red
  'rgba(245, 124, 0, 0.8)',   // Orange
  'rgba(123, 31, 162, 0.8)',  // Purple
  'rgba(0, 151, 167, 0.8)',   // Cyan
];

/**
 * Fetches a rendered Chart.js image from QuickChart.
 * @param {Object} chartConfig - The Chart.js configuration object.
 * @returns {Promise<Buffer|null>} - The binary image buffer, or null if it fails.
 */
export async function generateChartImage(chartConfig) {
  if (!chartConfig) return null;

  // Apply Premium Theme if not specified
  const styledConfig = { ...chartConfig };
  
  // Default options for premium look
  const defaultOptions = {
    plugins: {
      legend: {
        labels: {
          font: { size: 14, weight: 'bold' },
          color: '#37474F'
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(0,0,0,0.05)' },
        ticks: { color: '#455A64' }
      },
      x: {
        grid: { display: false },
        ticks: { color: '#455A64' }
      }
    }
  };

  styledConfig.options = { ...defaultOptions, ...styledConfig.options };

  // Ensure datasets have colors if none provided
  if (styledConfig.data && styledConfig.data.datasets) {
    styledConfig.data.datasets.forEach((dataset, i) => {
      if (!dataset.backgroundColor) {
        dataset.backgroundColor = PREMIUM_COLORS[i % PREMIUM_COLORS.length];
      }
      if (!dataset.borderColor) {
        dataset.borderColor = dataset.backgroundColor.replace('0.8', '1.0');
      }
      dataset.borderWidth = 2;
    });
  }

  try {
    console.log("[CHART] Requesting premium chart image via QuickChart...");
    const response = await axios.post("https://quickchart.io/chart", {
      chart: styledConfig,
      width: 1000,
      height: 600,
      backgroundColor: 'transparent',
      devicePixelRatio: 2 // High Resolution
    }, {
      responseType: "arraybuffer",
      timeout: 15000
    });
    
    console.log("[CHART] Successfully generated premium image!");
    return Buffer.from(response.data);
  } catch (error) {
    console.error("[CHART ERROR] Rendering failed:", error.message);
    return null;
  }
}

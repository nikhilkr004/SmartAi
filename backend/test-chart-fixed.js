function testChartParsing(configStr) {
  console.log(`\nTesting Config Str: ${configStr}`);
  try {
    let config;
    try {
      config = JSON.parse(configStr);
      console.log("✅ Direct JSON Parse Success!");
    } catch (e) {
      console.log("⚠️ Direct JSON Parse Failed, trying sanitizer...");
      // The sanitizer logic from processController.js
      const semiSanitized = configStr.replace(/(\s'|^'|'[:,\}\]])/g, '"').replace(/([:,\{\[]\s*')/g, '"');
      console.log(`Sanitized: ${semiSanitized}`);
      config = JSON.parse(semiSanitized);
      console.log("✅ Sanitized JSON Parse Success!");
    }
    console.log("Data keys:", Object.keys(config));
  } catch (err) {
    console.log(`❌ ALL PARSING FAILED: ${err.message}`);
  }
}

const cases = [
  '{"type": "bar", "data": {"labels": ["A", "B"], "datasets": [{"data": [1, 2]}]}}', // Perfect JSON
  "{'type': 'line', 'data': {'labels': ['Q1', 'Q2'], 'datasets': [{'label': 'Users', 'data': [100, 200]}]}}", // Single quotes
  "{'type': 'bar', 'data': {'labels': [\"Don't\", \"Do\"], 'datasets': [{'data': [5, 10]}]}}" // Mixed quotes with contraction
];

cases.forEach(testChartParsing);

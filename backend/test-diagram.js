import axios from 'axios';
import fs from 'fs';

async function testAll() {
  const code = "graph TD\nA-->B";
  
  // Test Kroki POST
  try {
    console.log("1. Testing Kroki POST...");
    const res = await axios.post("https://kroki.io/mermaid/png", code, { 
      headers: { 'Content-Type': 'text/plain' }, 
      responseType: "arraybuffer", 
      timeout: 5000 
    });
    console.log("Kroki POST Success! Size:", res.data.length);
    fs.writeFileSync("test.png", res.data);
    process.exit(0);
  } catch(e) {
    console.log("Kroki POST failed:", e.message);
  }

  // Test Quickchart GET
  try {
    console.log("2. Testing QuickChart GET...");
    const url = `https://quickchart.io/mermaid?graph=${encodeURIComponent(code)}`;
    const res = await axios.get(url, { responseType: "arraybuffer", timeout: 5000 });
    console.log("QuickChart GET Success! Size:", res.data.length);
    fs.writeFileSync("test.png", res.data);
    process.exit(0);
  } catch(e) {
    console.log("QuickChart GET failed:", e.message);
  }
}

testAll();

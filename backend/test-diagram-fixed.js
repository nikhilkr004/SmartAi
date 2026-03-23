import { generateMermaidImage } from "./utils/mermaidHelper.js";
import fs from "fs";

async function runTests() {
  console.log("--- Starting Mermaid Sanitization Tests ---");

  const testCases = [
    {
      name: "Standard Label",
      code: "graph TD\nA[Start] --> B[End]"
    },
    {
      name: "Nested Quotes (The problematic one)",
      code: `graph TD\nA["Start"] --> B["Time: O("N^2")"]`
    },
    {
      name: "Unbalanced Quotes and Special Chars",
      code: `graph TD\nA{Initialize: global_max = nums[0"], current_max = nums["0"]} --> B`
    },
    {
        name: "Arrows and Mixed styles",
        code: "graph TD\nA -> B[Message: 'Hello']\nB --> C{Decision?}\nC -- Yes --> D(Result: \"Done\")"
    }
  ];

  for (const tc of testCases) {
    console.log(`\nTesting: ${tc.name}`);
    console.log(`Original Code:\n${tc.code}`);
    
    try {
      const buffer = await generateMermaidImage(tc.code);
      if (buffer) {
        console.log(`✅ Success! Generated image size: ${buffer.length}`);
        const filename = `test_${tc.name.toLowerCase().replace(/\s+/g, '_')}.png`;
        fs.writeFileSync(filename, buffer);
        console.log(`Saved to ${filename}`);
      } else {
        console.log("❌ Failed: generateMermaidImage returned null");
      }
    } catch (e) {
      console.log(`❌ Error: ${e.message}`);
    }
  }

  console.log("\n--- Tests Complete ---");
}

runTests();

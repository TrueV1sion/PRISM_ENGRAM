import { present } from "./src/lib/pipeline/present";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

async function run() {
    console.log("Starting presentation generation test...");
    try {
        const result = await present({
            synthesis: {
                query: "GLP-1 Impact 2026",
                layers: [{ name: "Foundation", description: "Uncontested Ground", insights: ["Insight 1"] }],
                emergentInsights: [],
                tensionPoints: [],
                overallConfidence: "MEDIUM",
                criticRevisions: [],
            },
            agentResults: [{
                agentName: "Test Agent",
                archetype: "Analyst",
                dimension: "Clinical",
                findings: [{ statement: "GLP-1 cost offsets are delayed.", evidence: "Trials", implication: "Budget impact", sourceTier: "PRIMARY", confidence: "HIGH" }],
                gaps: [],
                signals: []
            }],
            blueprint: {
                id: "1",
                query: "GLP-1 Impact",
                tier: "STANDARD",
                dimensions: [{ name: "Clinical", priority: "HIGH", description: "Clinical" }],
                agents: [{ id: "1", name: "Test Agent", archetype: "Analyst", dimension: "Clinical", prompt: "", lens: "Cost" }]
            },
            emitEvent: (e) => console.log("Event:", e.type)
        });

        console.log("Presentation generated successfully!");
        console.log("Title:", result.title);
        console.log("Slide Count:", result.slideCount);
        console.log("HTML Size:", result.html.length, "bytes");

        // Write to a test file
        const fs = require('fs');
        fs.writeFileSync('./public/decks/test-css-exclusion.html', result.html);
        console.log("Saved to public/decks/test-css-exclusion.html");
    } catch (error) {
        console.error("Error generating presentation:", error);
    }
}

run();

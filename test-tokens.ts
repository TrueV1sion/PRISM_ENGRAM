import { Anthropic } from "@anthropic-ai/sdk";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function test() {
    try {
        const response = await client.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 16000,
            messages: [{ role: "user", content: "Write a 5000 word essay about the history of Rome." }],
        });
        console.log("Stop Reason:", response.stop_reason);
        console.log("Usage:", response.usage);
    } catch (err) {
        console.error("Error:", err);
    }
}

test();

try {
  process.loadEnvFile();
} catch {}

const { SarvamAIClient } = require("sarvamai");

const apiKey = process.env.SARVAM_API_KEY;
if (!apiKey) {
  console.error("SARVAM_API_KEY environment variable is not set.");
  process.exit(1);
}

const client = new SarvamAIClient({ apiSubscriptionKey: apiKey });

async function main() {
  const response = await client.chat.completions({
    model: "sarvam-105b-conversations",
    messages: [
      {
        role: "user",
        content: "Hello! Tell me an interesting fact about India in one sentence.",
      },
    ],
  });

  console.log(response.choices[0]?.message?.content);
}

main().catch(console.error);

try {
  process.loadEnvFile();
} catch {}

const fs = require("fs");
const path = require("path");
const { SarvamAIClient } = require("sarvamai");

const apiKey = process.env.SARVAM_API_KEY;
if (!apiKey) {
  console.error("Error: SARVAM_API_KEY environment variable is not set.");
  process.exit(1);
}

const client = new SarvamAIClient({ apiSubscriptionKey: apiKey });

const SYSTEM_PROMPT = `You are "Yojana Mitra", an empathetic, accessible AI voice assistant dedicated to helping Indian citizens understand government schemes (Central and State).

Guidelines:
1. Explain schemes in clear, simple, jargon-free language suitable for common citizens, farmers, and daily-wage workers.
2. Structure your answers concisely for speech:
   - What the scheme offers (benefits).
   - Who is eligible (key criteria).
   - Essential documents required (e.g., Aadhaar card, Bank Account with DBT, Ration Card).
   - Where to apply (nearest CSC center / official portal).
3. Always respond in the language spoken by the user (Hindi, Marathi, Bengali, Tamil, Telugu, English, etc.). Keep the response concise (2 to 4 sentences) so that it can be naturally spoken via Text-to-Speech.`;

/**
 * Transcribe an input audio file using Sarvam Saaras (Speech-to-Text).
 */
async function transcribeAudio(audioPath) {
  console.log(`\n🎙️  Transcribing audio file: ${audioPath}...`);
  const response = await client.speechToText.transcribe({
    file: fs.createReadStream(audioPath),
  });
  console.log(`Detected Language: ${response.language_code || "Unknown"}`);
  console.log(`Transcribed Query: "${response.transcript}"`);
  return {
    transcript: response.transcript,
    languageCode: response.language_code || "hi-IN",
  };
}

/**
 * Ask the Government Scheme Assistant using sarvam-105b-conversations.
 */
async function querySchemeAssistant(userQuery) {
  console.log(`\n🧠 Consulting Yojana Mitra (sarvam-105b-conversations)...`);
  const response = await client.chat.completions({
    model: "sarvam-105b-conversations",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userQuery },
    ],
    temperature: 0.3,
  });

  const reply = response.choices[0]?.message?.content || "";
  console.log(`\n📢 Assistant Reply:\n${reply}`);
  return reply;
}

/**
 * Synthesize speech from text using Sarvam Bulbul (Text-to-Speech).
 */
async function synthesizeSpeech(text, languageCode = "hi-IN", outputPath = "reply.wav") {
  console.log(`\n🔊 Synthesizing speech with Bulbul (${languageCode})...`);
  
  // Ensure text length does not exceed bulbul limits
  const sanitizedText = text.slice(0, 2000);

  const response = await client.textToSpeech.convert({
    text: sanitizedText,
    language_code: languageCode,
    model: "bulbul:v3",
  });

  if (response.audios && response.audios[0]) {
    const audioBuffer = Buffer.from(response.audios[0], "base64");
    fs.writeFileSync(outputPath, audioBuffer);
    console.log(`✅ Audio response saved to: ${outputPath} (${audioBuffer.length} bytes)`);
    return outputPath;
  } else {
    throw new Error("No audio returned from Sarvam TTS.");
  }
}

/**
 * Main orchestration function.
 */
async function main() {
  const args = process.argv.slice(2);
  let userQuery = "";
  let languageCode = "hi-IN";

  if (args.length > 0 && fs.existsSync(args[0])) {
    // Audio file mode
    const audioResult = await transcribeAudio(args[0]);
    userQuery = audioResult.transcript;
    languageCode = audioResult.languageCode;
  } else if (args.length > 0) {
    // Text query provided via CLI argument
    userQuery = args.join(" ");
  } else {
    // Default demo question
    userQuery = "मुझे पीएम किसान योजना (PM-Kisan) के बारे में बताइए, मुझे इसके लिए क्या दस्तावेज चाहिए और कितने पैसे मिलते हैं?";
    console.log(`Using demo citizen query: "${userQuery}"`);
  }

  // 1. Get Scheme Explanation from LLM
  const assistantReply = await querySchemeAssistant(userQuery);

  // 2. Synthesize Voice Output
  const outputFile = path.join(__dirname, "reply.wav");
  await synthesizeSpeech(assistantReply, languageCode, outputFile);

  console.log("\n🎉 Full Voice Assistant cycle completed successfully!");
}

main().catch((err) => {
  console.error("Error running Government Scheme Assistant:", err);
  process.exit(1);
});

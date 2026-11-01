try {
  process.loadEnvFile();
} catch {}

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { SarvamAIClient } = require("sarvamai");

const apiKey = process.env.SARVAM_API_KEY;
if (!apiKey) {
  console.error("FATAL: SARVAM_API_KEY is not defined in environment or .env");
  process.exit(1);
}

const client = new SarvamAIClient({ apiSubscriptionKey: apiKey });
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));
app.use(express.static(path.join(__dirname, "public")));

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || (file.mimetype.includes("audio") ? ".webm" : ".dat");
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});
const upload = multer({ storage });

const SUPPORTED_TTS_LANGUAGES = [
  "hi-IN", "mr-IN", "bn-IN", "gu-IN", "ta-IN", "te-IN", "kn-IN", "ml-IN", "pa-IN", "od-IN", "en-IN"
];

function normalizeTtsLang(code) {
  if (code && SUPPORTED_TTS_LANGUAGES.includes(code)) return code;
  return "hi-IN";
}

const ASSISTANT_SYSTEM_PROMPT = `You are "Yojana Mitra" (योजना मित्र), an empathetic, accessible AI voice assistant dedicated to helping Indian citizens, farmers, workers, and students understand government welfare schemes and Central Government scholarships.

Guidelines:
1. Explain government schemes and scholarships in clear, simple, conversational language.
2. If asked about student scholarships, highlight Central Government schemes from the National Scholarship Portal (NSP), AICTE (Pragati/Saksham), Ministry of Education (CSSS/PM-USP), Ministry of Social Justice (Post-Matric for SC/OBC, PM Yasasvi), etc.
3. Structure your answers concisely for voice playback:
   - What the scheme/scholarship offers (financial benefit / award amount).
   - Who is eligible (marks %, category, annual family income limits).
   - Essential documents required (e.g., Aadhaar card, Marksheet, Income certificate, Bonafide certificate).
   - Where to apply (National Scholarship Portal scholarships.gov.in / CSC center).
4. Always respond in the language spoken by the user (Hindi, Marathi, Bengali, Tamil, Telugu, English, etc.).
5. Keep the answer concise (3-4 sentences max) so that it can be naturally spoken via Text-to-Speech.`;

const ELIGIBILITY_SYSTEM_PROMPT = `You are an expert Government Scheme Eligibility Evaluator for India (Central and State welfare schemes like PM-Kisan, Ayushman Bharat PM-JAY, PM Awas Yojana, PM Vishwakarma, Atal Pension Yojana, Sukanya Samriddhi Yojana, Pradhan Mantri Fasal Bima, State Women Schemes like Ladki Bahin, etc.).

Analyze the citizen profile or document text provided and return STRICT VALID JSON ONLY (no markdown fences, no extra text).
JSON structure:
{
  "profile_summary": "Short 1-2 sentence summary of the citizen profile (age, occupation, income, land, state, ration card status)",
  "language_code": "hi-IN or en-IN or mr-IN depending on context",
  "eligible_schemes": [
    {
      "scheme_name": "Official Scheme Name",
      "category": "Agriculture | Healthcare | Housing | Women & Child | Pension | Financial Aid",
      "benefit": "Concise summary of exact financial/material benefits (e.g. ₹6,000/year, ₹5 Lakh health cover)",
      "why_eligible": "Clear explanation of how citizen meets criteria",
      "required_docs": ["Document 1", "Document 2"],
      "how_to_apply": "Where and how to apply (CSC center, Portal link)",
      "voice_summary": "1-2 sentence spoken summary suitable for text-to-speech in the user's language"
    }
  ],
  "potential_schemes": [
    {
      "scheme_name": "Scheme Name",
      "condition": "What condition must be met",
      "missing_info": "What document or information is needed to confirm eligibility"
    }
  ]
}`;

const SCHOLARSHIP_SYSTEM_PROMPT = `You are the Central Government Scholarship Advisor (National Scholarship Portal - NSP expert) in India.
Your mission is to evaluate a student's academic and socioeconomic background and identify the exact Central Government scholarship schemes they are eligible for.

Cover major Central Government / NSP schemes such as:
1. Central Sector Scheme of Scholarship for College and University Students (PM-USP / CSSS by Ministry of Education - ₹12,000 to ₹20,000/year)
2. AICTE Pragati Scholarship for Girls (Technical Degree/Diploma - ₹50,000/year)
3. AICTE Saksham Scholarship for Specially-Abled Students (₹50,000/year)
4. PM Yasasvi Scheme (OBC, EBC, DNT students - Top Class College education up to ₹2.5 Lakhs & School Scholarships)
5. Post-Matric Scholarships for SC / ST / OBC / Minorities (Full tuition reimbursement + maintenance allowance)
6. National Means-cum-Merit Scholarship Scheme (NMMSS - ₹12,000/year for Class 9-12)
7. INSPIRE Scholarship for Higher Education (SHE by DST - ₹80,000/year for pure sciences)
8. Begum Hazrat Mahal National Scholarship (Minority female students in Class 9-12)
9. Ishan Uday Special Scholarship for North Eastern Region (NER - ₹5,400 to ₹7,800/month)
10. Prime Minister's Scholarship Scheme (PMSS) for Wards of CAPF/AR & Ex-Servicemen

Return STRICT VALID JSON ONLY (no markdown fences, no extra text outside json).
JSON format:
{
  "student_summary": "1-2 sentence summary of the student's qualification, course, and background",
  "language_code": "hi-IN or en-IN",
  "eligible_scholarships": [
    {
      "scholarship_name": "Official Scholarship Name",
      "ministry": "Ministry of Education / AICTE / MoSJE / DST / UGC",
      "award_amount": "Exact amount per year or benefits (e.g. ₹50,000/वर्ष या पूर्ण फीस प्रतिपूर्ति)",
      "why_eligible": "Clear explanation of how student meets criteria (marks %, category, income ceiling)",
      "eligibility_criteria": "Key conditions (marks, family income limit, institution type)",
      "portal_and_application": "National Scholarship Portal (scholarships.gov.in) or AICTE portal instructions",
      "voice_summary": "1-2 conversational sentences in Hindi or Indian English suitable for Text-to-Speech summarizing the best scholarship for this student"
    }
  ],
  "tips": [
    "Important NSP document or renewal tip (e.g. Aadhaar seeding with bank account, bonafide certificate from college)"
  ]
}`;

/**
 * 1. VOICE QUERY ENDPOINT
 */
app.post("/api/voice-query", upload.single("audio"), async (req, res) => {
  let audioFilePath = null;
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No audio file uploaded." });
    }

    audioFilePath = req.file.path;
    const preferredLang = req.body.languageCode || "unknown";

    console.log(`[Voice Query] Received file: ${req.file.originalname} (${req.file.size} bytes)`);

    const transcribeOptions = {
      file: fs.createReadStream(audioFilePath),
      model: "saaras:v3",
    };
    if (preferredLang && preferredLang !== "unknown") {
      transcribeOptions.language_code = preferredLang;
    }

    const sttResponse = await client.speechToText.transcribe(transcribeOptions);
    const transcript = sttResponse.transcript?.trim() || "";
    const detectedLang = normalizeTtsLang(sttResponse.language_code || preferredLang);

    console.log(`[Voice Query] Transcribed: "${transcript}" (Language: ${detectedLang})`);

    if (!transcript) {
      return res.json({
        transcript: "",
        replyText: "हम आपकी आवाज़ सुन नहीं पाए। कृपया माइक्रोफ़ोन के पास आकर दोबारा बोलें।",
        audioBase64: null,
        languageCode: detectedLang,
      });
    }

    const completion = await client.chat.completions({
      model: "sarvam-105b-conversations",
      messages: [
        { role: "system", content: ASSISTANT_SYSTEM_PROMPT },
        { role: "user", content: transcript },
      ],
      temperature: 0.3,
    });
    const replyText = completion.choices[0]?.message?.content || "माफ़ कीजिए, अभी जानकारी उपलब्ध नहीं हो पाई।";

    let audioBase64 = null;
    try {
      const ttsResponse = await client.textToSpeech.convert({
        text: replyText.slice(0, 2000),
        language_code: detectedLang,
        model: "bulbul:v3",
      });
      if (ttsResponse.audios && ttsResponse.audios[0]) {
        audioBase64 = ttsResponse.audios[0];
      }
    } catch (ttsErr) {
      console.warn("[Voice Query] TTS conversion warning:", ttsErr.message);
    }

    res.json({
      transcript,
      replyText,
      audioBase64,
      languageCode: detectedLang,
    });
  } catch (err) {
    console.error("[Voice Query Error]", err);
    res.status(500).json({ error: err.message || "Failed to process voice query." });
  } finally {
    if (audioFilePath && fs.existsSync(audioFilePath)) {
      try { fs.unlinkSync(audioFilePath); } catch {}
    }
  }
});

/**
 * 2. TEXT QUERY ENDPOINT
 */
app.post("/api/text-query", async (req, res) => {
  try {
    const { query, languageCode } = req.body;
    if (!query || !query.trim()) {
      return res.status(400).json({ error: "Query is required." });
    }

    const lang = normalizeTtsLang(languageCode || "hi-IN");

    const completion = await client.chat.completions({
      model: "sarvam-105b-conversations",
      messages: [
        { role: "system", content: ASSISTANT_SYSTEM_PROMPT },
        { role: "user", content: query },
      ],
      temperature: 0.3,
    });
    const replyText = completion.choices[0]?.message?.content || "";

    let audioBase64 = null;
    try {
      const ttsResponse = await client.textToSpeech.convert({
        text: replyText.slice(0, 2000),
        language_code: lang,
        model: "bulbul:v3",
      });
      if (ttsResponse.audios && ttsResponse.audios[0]) {
        audioBase64 = ttsResponse.audios[0];
      }
    } catch (ttsErr) {
      console.warn("[Text Query] TTS warning:", ttsErr.message);
    }

    res.json({
      replyText,
      audioBase64,
      languageCode: lang,
    });
  } catch (err) {
    console.error("[Text Query Error]", err);
    res.status(500).json({ error: err.message || "Failed to process text query." });
  }
});

/**
 * 3. DOCUMENT ELIGIBILITY SCANNER ENDPOINT
 */
app.post("/api/scan-document", upload.single("document"), async (req, res) => {
  let uploadedFilePath = null;
  try {
    let rawTextContent = req.body.profileText || "";

    if (req.file) {
      uploadedFilePath = req.file.path;
      console.log(`[Doc Scanner] Uploaded: ${req.file.originalname} (${req.file.size} bytes)`);

      try {
        const parseJob = await client.docAi.parse({
          file: [fs.createReadStream(uploadedFilePath)],
        });

        if (parseJob && parseJob.job_id) {
          console.log(`[Doc Scanner] DocAI job initiated: ${parseJob.job_id}`);
          let attempts = 0;
          while (attempts < 8) {
            await new Promise((r) => setTimeout(r, 1500));
            const status = await client.docAi.getStatus(parseJob.job_id);
            if (status.status === "completed") {
              const results = await client.docAi.getResults(parseJob.job_id);
              if (results && results.text) {
                rawTextContent += "\n" + results.text;
              }
              break;
            } else if (status.status === "failed" || status.status === "rejected") {
              console.warn("[Doc Scanner] DocAI job ended with status:", status.status);
              break;
            }
            attempts++;
          }
        }
      } catch (docAiErr) {
        console.warn("[Doc Scanner] DocAI parse fallback:", docAiErr.message);
      }

      if (!rawTextContent.trim()) {
        rawTextContent = `Citizen uploaded document file: ${req.file.originalname}. Details: ${req.body.notes || "Standard Indian citizen applicant documentation"}`;
      }
    }

    if (!rawTextContent.trim()) {
      return res.status(400).json({ error: "Please provide a document or citizen profile description." });
    }

    console.log(`[Doc Scanner] Evaluating profile text with sarvam-105b-conversations...`);

    const completion = await client.chat.completions({
      model: "sarvam-105b-conversations",
      messages: [
        { role: "system", content: ELIGIBILITY_SYSTEM_PROMPT },
        { role: "user", content: `Citizen Profile / Document Info:\n${rawTextContent}` },
      ],
      temperature: 0.1,
    });

    let resultJson = null;
    const content = completion.choices[0]?.message?.content || "";
    try {
      const cleaned = content.replace(/```json/g, "").replace(/```/g, "").trim();
      resultJson = JSON.parse(cleaned);
    } catch (parseErr) {
      console.warn("[Doc Scanner] Direct JSON parse fallback:", content);
      resultJson = {
        profile_summary: rawTextContent.slice(0, 200),
        language_code: "hi-IN",
        eligible_schemes: [],
        potential_schemes: [],
      };
    }

    res.json(resultJson);
  } catch (err) {
    console.error("[Doc Scanner Error]", err);
    res.status(500).json({ error: err.message || "Failed to scan document." });
  } finally {
    if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
      try { fs.unlinkSync(uploadedFilePath); } catch {}
    }
  }
});

/**
 * 4. STUDENT SCHOLARSHIP EVALUATOR ENDPOINT
 * Matches student against Central Government scholarships (NSP, PM-USP, AICTE, etc.)
 */
app.post("/api/scholarship-check", async (req, res) => {
  try {
    const {
      academicLevel,
      course,
      marksPercent,
      category,
      gender,
      annualIncome,
      state,
      freeText,
    } = req.body;

    let studentProfile = "";
    if (freeText && freeText.trim()) {
      studentProfile = freeText.trim();
    } else {
      studentProfile = `Student Profile:
- Gender: ${gender || "Not specified"}
- Current Academic Level: ${academicLevel || "College/UG"}
- Course/Stream: ${course || "General"}
- Marks in Qualifying Exam: ${marksPercent ? marksPercent + "%" : "Not specified"}
- Category: ${category || "General"}
- Annual Family Income: INR ${annualIncome || "2,00,000"}
- Domicile State: ${state || "India"}`;
    }

    console.log(`[Scholarship Check] Evaluating student profile:\n${studentProfile}`);

    const completion = await client.chat.completions({
      model: "sarvam-105b-conversations",
      messages: [
        { role: "system", content: SCHOLARSHIP_SYSTEM_PROMPT },
        { role: "user", content: studentProfile },
      ],
      temperature: 0.1,
    });

    let resultJson = null;
    const content = completion.choices[0]?.message?.content || "";
    try {
      const cleaned = content.replace(/```json/g, "").replace(/```/g, "").trim();
      resultJson = JSON.parse(cleaned);
    } catch (parseErr) {
      console.warn("[Scholarship Check] JSON parse fallback:", content);
      resultJson = {
        student_summary: studentProfile.slice(0, 200),
        language_code: "hi-IN",
        eligible_scholarships: [],
        tips: ["Apply early on the National Scholarship Portal (scholarships.gov.in) with valid Aadhaar and income proofs."],
      };
    }

    res.json(resultJson);
  } catch (err) {
    console.error("[Scholarship Check Error]", err);
    res.status(500).json({ error: err.message || "Failed to evaluate scholarships." });
  }
});

/**
 * 5. TEXT-TO-SPEECH ENDPOINT
 */
app.post("/api/speak", async (req, res) => {
  try {
    const { text, languageCode } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Text is required." });
    }

    const lang = normalizeTtsLang(languageCode || "hi-IN");
    const ttsResponse = await client.textToSpeech.convert({
      text: text.slice(0, 2000),
      language_code: lang,
      model: "bulbul:v3",
    });

    if (ttsResponse.audios && ttsResponse.audios[0]) {
      res.json({ audioBase64: ttsResponse.audios[0], languageCode: lang });
    } else {
      res.status(500).json({ error: "Failed to generate audio." });
    }
  } catch (err) {
    console.error("[TTS Error]", err);
    res.status(500).json({ error: err.message || "TTS error." });
  }
});

app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Yojana Mitra Server is live at http://localhost:${PORT}`);
  console.log(`======================================================\n`);
});

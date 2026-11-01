// State management
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let recordingStartTime = null;
let timerInterval = null;
let currentAudio = null;

// DOM Elements
const tabBtns = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab-content");

// Voice Assistant Elements
const micBtn = document.getElementById("micBtn");
const micRing = document.getElementById("micRing");
const statusIndicator = document.getElementById("statusIndicator");
const statusText = document.getElementById("statusText");
const recordingTimer = document.getElementById("recordingTimer");
const conversationArea = document.getElementById("conversationArea");
const userTranscriptText = document.getElementById("userTranscriptText");
const assistantReplyText = document.getElementById("assistantReplyText");
const detectedLangBadge = document.getElementById("detectedLangBadge");
const replayAudioBtn = document.getElementById("replayAudioBtn");
const audioPlayerBar = document.getElementById("audioPlayerBar");
const textQueryForm = document.getElementById("textQueryForm");
const textQueryInput = document.getElementById("textQueryInput");
const promptChips = document.querySelectorAll(".chip");

// Scholarship Tab Elements
const scholarshipForm = document.getElementById("scholarshipForm");
const schLevel = document.getElementById("schLevel");
const schGender = document.getElementById("schGender");
const schCategory = document.getElementById("schCategory");
const schMarks = document.getElementById("schMarks");
const schIncome = document.getElementById("schIncome");
const schCourse = document.getElementById("schCourse");
const schFreeText = document.getElementById("schFreeText");
const emptyScholarshipState = document.getElementById("emptyScholarshipState");
const scholarshipLoading = document.getElementById("scholarshipLoading");
const scholarshipResultsContent = document.getElementById("scholarshipResultsContent");
const studentSummaryText = document.getElementById("studentSummaryText");
const scholarshipsList = document.getElementById("scholarshipsList");
const scholarshipTipsBox = document.getElementById("scholarshipTipsBox");
const scholarshipTipsList = document.getElementById("scholarshipTipsList");
const studentPresets = document.querySelectorAll(".student-preset");

// Document Scanner Elements
const fileDropzone = document.getElementById("fileDropzone");
const docFileInput = document.getElementById("docFileInput");
const selectedFileName = document.getElementById("selectedFileName");
const profileTextInput = document.getElementById("profileTextInput");
const scanBtn = document.getElementById("scanBtn");
const emptyResultsState = document.getElementById("emptyResultsState");
const scannerLoading = document.getElementById("scannerLoading");
const resultsContent = document.getElementById("resultsContent");
const profileSummaryText = document.getElementById("profileSummaryText");
const eligibleSchemesList = document.getElementById("eligibleSchemesList");
const potentialSchemesList = document.getElementById("potentialSchemesList");
const presetButtons = document.querySelectorAll(".preset-btn:not(.student-preset)");

// 1. Tab Switching
tabBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabBtns.forEach((b) => b.classList.remove("active"));
    tabContents.forEach((c) => (c.style.display = "none"));

    btn.classList.add("active");
    const target = document.getElementById(btn.dataset.tab);
    if (target) {
      target.style.display = "block";
    }
  });
});

// 2. Audio Playback Helper
let lastBase64Audio = null;

function playAudioBase64(base64Data) {
  if (!base64Data) return;
  lastBase64Audio = base64Data;

  if (currentAudio) {
    try {
      currentAudio.pause();
    } catch {}
  }

  currentAudio = new Audio(`data:audio/wav;base64,${base64Data}`);
  if (audioPlayerBar) audioPlayerBar.style.display = "flex";

  currentAudio.play().catch((err) => {
    console.warn("Autoplay blocked or audio play error:", err);
  });

  currentAudio.onended = () => {
    if (audioPlayerBar) audioPlayerBar.style.display = "none";
  };
}

replayAudioBtn?.addEventListener("click", () => {
  if (lastBase64Audio) {
    playAudioBase64(lastBase64Audio);
  }
});

// 3. Microphone Recording Handling
micBtn?.addEventListener("click", async () => {
  if (isRecording) {
    stopRecording();
  } else {
    await startRecording();
  }
});

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];

    const options = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? { mimeType: "audio/webm;codecs=opus" }
      : {};

    mediaRecorder = new MediaRecorder(stream, options);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop());
      const mimeType = mediaRecorder.mimeType || "audio/webm";
      const audioBlob = new Blob(audioChunks, { type: mimeType });
      await processRecordedAudio(audioBlob);
    };

    mediaRecorder.start();
    isRecording = true;
    micRing.classList.add("recording");
    statusIndicator.classList.add("recording");
    statusText.textContent = "सुन रहे हैं... बोलिए (Listening... Speak now)";
    recordingTimer.style.display = "block";
    recordingStartTime = Date.now();

    timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
      const mins = String(Math.floor(elapsed / 60)).padStart(2, "0");
      const secs = String(elapsed % 60).padStart(2, "0");
      recordingTimer.textContent = `${mins}:${secs}`;
    }, 500);
  } catch (err) {
    console.error("Microphone access error:", err);
    alert("माइक्रोफ़ोन तक पहुँच नहीं मिल सकी। कृपया अनुमति दें। (Microphone permission needed)");
  }
}

function stopRecording() {
  if (!isRecording) return;
  isRecording = false;
  clearInterval(timerInterval);
  recordingTimer.style.display = "none";
  micRing.classList.remove("recording");
  statusIndicator.classList.remove("recording");
  statusText.textContent = "Sarvam AI प्रसंस्करण कर रहा है (Processing with Sarvam AI...)";

  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
}

async function processRecordedAudio(blob) {
  try {
    const formData = new FormData();
    const ext = blob.type.includes("wav") ? "wav" : "webm";
    formData.append("audio", blob, `user_voice.${ext}`);
    formData.append("languageCode", "unknown");

    statusText.textContent = "Saaras: आवाज़ को टेक्स्ट में बदला जा रहा है... (Transcribing...)";

    const response = await fetch("/api/voice-query", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error);

    displayConversation(data.transcript || "(आवाज़ नहीं सुनी जा सकी)", data.replyText, data.languageCode);

    if (data.audioBase64) {
      playAudioBase64(data.audioBase64);
    }

    statusText.textContent = "माइक पर क्लिक करें और पूछें (Click to Speak)";
  } catch (err) {
    console.error("Voice query failed:", err);
    statusText.textContent = `त्रुटि: ${err.message || "Failed to process query"}`;
  }
}

// 4. Text & Quick Chip Handling
function displayConversation(query, reply, langCode) {
  conversationArea.style.display = "flex";
  userTranscriptText.textContent = query;
  assistantReplyText.textContent = reply;
  detectedLangBadge.textContent = langCode || "hi-IN";
}

async function sendTextQuery(query, langOverride = null) {
  try {
    statusText.textContent = "Sarvam-105B उत्तर तैयार कर रहा है... (Consulting...)";
    const languageCode = langOverride || "hi-IN";

    const response = await fetch("/api/text-query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, languageCode }),
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error);

    displayConversation(query, data.replyText, data.languageCode);

    if (data.audioBase64) {
      playAudioBase64(data.audioBase64);
    }

    statusText.textContent = "माइक पर क्लिक करें और पूछें (Click to Speak)";
  } catch (err) {
    console.error("Text query error:", err);
    statusText.textContent = `त्रुटि: ${err.message}`;
  }
}

textQueryForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  const q = textQueryInput.value.trim();
  if (q) {
    sendTextQuery(q);
    textQueryInput.value = "";
  }
});

promptChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    const q = chip.dataset.query;
    const l = chip.dataset.lang || null;
    if (q) sendTextQuery(q, l);
  });
});

// 5. Student Scholarship Tab
const STUDENT_PRESET_DATA = {
  btech_girl: {
    level: "Undergraduate (UG / College / B.Tech / B.Sc / BA)",
    gender: "Female",
    cat: "General / EWS",
    marks: "86",
    income: "210000",
    course: "1st Year B.Tech Computer Science",
    notes: "Passed Class 12 CBSE with 86% marks, enrolled in AICTE approved college.",
  },
  ug_obc: {
    level: "Undergraduate (UG / College / B.Tech / B.Sc / BA)",
    gender: "Male",
    cat: "OBC (Other Backward Classes)",
    marks: "78",
    income: "150000",
    course: "B.Sc Physics 1st Year",
    notes: "Top 20th percentile in state board 12th exam, non-creamy layer OBC.",
  },
  sc_school: {
    level: "Class 11-12 (Higher Secondary)",
    gender: "Male",
    cat: "SC (Scheduled Caste)",
    marks: "74",
    income: "90000",
    course: "Class 11 Science",
    notes: "Passed Class 10 with 74%, studying in government aided school, rural area.",
  },
};

studentPresets.forEach((btn) => {
  btn.addEventListener("click", () => {
    const key = btn.dataset.preset;
    const data = STUDENT_PRESET_DATA[key];
    if (data) {
      schLevel.value = data.level;
      schGender.value = data.gender;
      schCategory.value = data.cat;
      schMarks.value = data.marks;
      schIncome.value = data.income;
      schCourse.value = data.course;
      schFreeText.value = data.notes;
    }
  });
});

scholarshipForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  emptyScholarshipState.style.display = "none";
  scholarshipResultsContent.style.display = "none";
  scholarshipLoading.style.display = "block";

  try {
    const payload = {
      academicLevel: schLevel.value,
      gender: schGender.value,
      category: schCategory.value,
      marksPercent: schMarks.value,
      annualIncome: schIncome.value,
      course: schCourse.value,
      freeText: schFreeText.value,
    };

    const res = await fetch("/api/scholarship-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error);

    renderScholarshipResults(data);
  } catch (err) {
    console.error("Scholarship check error:", err);
    alert(`छात्रवृत्ति जांच त्रुटि: ${err.message}`);
    emptyScholarshipState.style.display = "block";
  } finally {
    scholarshipLoading.style.display = "none";
  }
});

function renderScholarshipResults(data) {
  studentSummaryText.textContent = data.student_summary || "विद्यार्थी प्रोफ़ाइल सारांश";
  scholarshipsList.innerHTML = "";

  const langCode = data.language_code || "hi-IN";

  if (data.eligible_scholarships && data.eligible_scholarships.length > 0) {
    data.eligible_scholarships.forEach((sch) => {
      const card = document.createElement("div");
      card.className = "scheme-card";
      card.innerHTML = `
        <div class="scheme-header">
          <div class="scheme-name">🎓 ${sch.scholarship_name}</div>
          <span class="scheme-cat ministry-tag">${sch.ministry || "भारत सरकार"}</span>
        </div>
        <div class="scheme-benefit scholarship-amount-badge">💵 राशि / लाभ: ${sch.award_amount}</div>
        <p class="scheme-why"><strong>क्यों योग्य हैं:</strong> ${sch.why_eligible}</p>
        <div class="scheme-details">
          <p><strong>पात्रता शर्तें:</strong> ${sch.eligibility_criteria || "न्यूनतम अंक एवं आय सीमा"}</p>
          <p class="mt-1"><strong>आवेदन पोर्टल:</strong> ${sch.portal_and_application || "National Scholarship Portal (scholarships.gov.in)"}</p>
        </div>
        <div class="scheme-actions">
          <button class="btn-speak-scheme" data-text="${escapeHtml(sch.voice_summary || sch.award_amount)}" data-lang="${langCode}">
            🔊 सुनिए (Listen)
          </button>
        </div>
      `;
      scholarshipsList.appendChild(card);
    });
  } else {
    scholarshipsList.innerHTML = "<p class='text-muted'>इस प्रोफ़ाइल के लिए कोई विशिष्ट केंद्रीय छात्रवृत्ति नहीं मिली।</p>";
  }

  // Tips
  if (data.tips && data.tips.length > 0) {
    scholarshipTipsList.innerHTML = "";
    data.tips.forEach((tip) => {
      const li = document.createElement("li");
      li.textContent = tip;
      scholarshipTipsList.appendChild(li);
    });
    scholarshipTipsBox.style.display = "block";
  } else {
    scholarshipTipsBox.style.display = "none";
  }

  attachSpeakListeners();
  scholarshipResultsContent.style.display = "block";
}

// 6. Document Scanner Tab
const PRESET_DATA = {
  farmer: "छोटा किसान (महाराष्ट्र): नाम - रमेश, आयु 42 वर्ष, 1.8 एकड़ कृषि भूमि (7/12 extract उपलब्ध), वार्षिक पारिवारिक आय ₹85,000, पीला बीपीएल राशन कार्ड धारक, परिवार में पत्नी और 1 पुत्री (आयु 7 वर्ष)।",
  artisan: "ग्रामीण कारीगर महिला (उत्तर प्रदेश): नाम - सुनीता देवी, आयु 32 वर्ष, पारंपरिक सिलाई एवं हस्तशिल्प कार्य (tailor/artisan), भूमिहीन, वार्षिक आय ₹60,000, बीपीएल राशन कार्ड, 2 बच्चे।",
  elderly: "वृद्ध ग्रामीण श्रमिक (राजस्थान): नाम - रामलाल, आयु 67 वर्ष, असंगठित दिहाड़ी मजदूर, कच्चा मकान, कोई स्थायी भूमि नहीं, वार्षिक आय ₹45,000, अंत्योदय (AAY) राशन कार्ड।",
};

presetButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const key = btn.dataset.preset;
    if (PRESET_DATA[key]) {
      profileTextInput.value = PRESET_DATA[key];
    }
  });
});

docFileInput?.addEventListener("change", () => {
  if (docFileInput.files && docFileInput.files[0]) {
    selectedFileName.style.display = "block";
    selectedFileName.textContent = `📎 चयनित फ़ाइल: ${docFileInput.files[0].name} (${Math.round(docFileInput.files[0].size / 1024)} KB)`;
  }
});

scanBtn?.addEventListener("click", async () => {
  const profileText = profileTextInput.value.trim();
  const file = docFileInput.files ? docFileInput.files[0] : null;

  if (!profileText && !file) {
    alert("कृपया कोई दस्तावेज अपलोड करें या विवरण दर्ज करें।");
    return;
  }

  emptyResultsState.style.display = "none";
  resultsContent.style.display = "none";
  scannerLoading.style.display = "block";

  try {
    const formData = new FormData();
    if (file) formData.append("document", file);
    if (profileText) formData.append("profileText", profileText);

    const res = await fetch("/api/scan-document", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error);

    renderScanResults(data);
  } catch (err) {
    console.error("Scan error:", err);
    alert(`दस्तावेज स्कैन त्रुटि: ${err.message}`);
    emptyResultsState.style.display = "block";
  } finally {
    scannerLoading.style.display = "none";
  }
});

function renderScanResults(data) {
  profileSummaryText.textContent = data.profile_summary || "नागरिक प्रोफ़ाइल";
  eligibleSchemesList.innerHTML = "";
  potentialSchemesList.innerHTML = "";

  const langCode = data.language_code || "hi-IN";

  if (data.eligible_schemes && data.eligible_schemes.length > 0) {
    data.eligible_schemes.forEach((scheme) => {
      const card = document.createElement("div");
      card.className = "scheme-card";
      card.innerHTML = `
        <div class="scheme-header">
          <div class="scheme-name">🌟 ${scheme.scheme_name}</div>
          <span class="scheme-cat">${scheme.category || "सरकारी योजना"}</span>
        </div>
        <div class="scheme-benefit">💰 लाभ: ${scheme.benefit}</div>
        <p class="scheme-why"><strong>क्यों पात्र हैं:</strong> ${scheme.why_eligible}</p>
        <div class="scheme-details">
          <p><strong>आवश्यक दस्तावेज:</strong> ${scheme.required_docs ? scheme.required_docs.join(", ") : "आधार, बैंक पासबुक"}</p>
          <p class="mt-1"><strong>आवेदन कहाँ करें:</strong> ${scheme.how_to_apply || "नजदीकी CSC केंद्र"}</p>
        </div>
        <div class="scheme-actions">
          <button class="btn-speak-scheme" data-text="${escapeHtml(scheme.voice_summary || scheme.benefit)}" data-lang="${langCode}">
            🔊 सुनिए (Listen)
          </button>
        </div>
      `;
      eligibleSchemesList.appendChild(card);
    });
  } else {
    eligibleSchemesList.innerHTML = "<p class='text-muted'>कोई पूर्ण पात्र योजना नहीं मिली।</p>";
  }

  if (data.potential_schemes && data.potential_schemes.length > 0) {
    data.potential_schemes.forEach((scheme) => {
      const card = document.createElement("div");
      card.className = "scheme-card";
      card.innerHTML = `
        <div class="scheme-header">
          <div class="scheme-name">📌 ${scheme.scheme_name}</div>
        </div>
        <p class="scheme-why"><strong>शर्त:</strong> ${scheme.condition}</p>
        <div class="scheme-details">
          <p><strong>अपेक्षित जानकारी/दस्तावेज:</strong> ${scheme.missing_info}</p>
        </div>
      `;
      potentialSchemesList.appendChild(card);
    });
  }

  attachSpeakListeners();
  resultsContent.style.display = "block";
}

function attachSpeakListeners() {
  document.querySelectorAll(".btn-speak-scheme").forEach((btn) => {
    btn.onclick = async () => {
      const textToSpeak = btn.dataset.text;
      const lang = btn.dataset.lang || "hi-IN";
      btn.textContent = "🔊 बज रहा है...";
      try {
        const res = await fetch("/api/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: textToSpeak, languageCode: lang }),
        });
        const d = await res.json();
        if (d.audioBase64) {
          playAudioBase64(d.audioBase64);
        }
      } catch (e) {
        console.error(e);
      } finally {
        btn.textContent = "🔊 सुनिए (Listen)";
      }
    };
  });
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

import express from "express";
import path from "path";
import fs from "fs";
import os from "os";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { EdgeTTS } from "node-edge-tts";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// In-memory audio cache for synthesized Edge-TTS phrases (Max 300 entries)
const audioCache = new Map<string, Buffer>();
const MAX_CACHE_ITEMS = 300;

function getCacheKey(text: string, voice: string, rate: string, pitch: string): string {
  return crypto.createHash("md5").update(`${text}_${voice}_${rate}_${pitch}`).digest("hex");
}

// Default Neural Voice mappings by language and gender
const DEFAULT_EDGE_VOICES: Record<string, { male: string; female: string }> = {
  "en-US": { male: "en-US-GuyNeural", female: "en-US-JennyNeural" },
  "en-GB": { male: "en-GB-RyanNeural", female: "en-GB-SoniaNeural" },
  "en-IN": { male: "en-IN-PrabhatNeural", female: "en-IN-NeerjaNeural" },
  "ur-PK": { male: "ur-PK-AsadNeural", female: "ur-PK-UzmaNeural" },
  "hi-IN": { male: "hi-IN-MadhurNeural", female: "hi-IN-SwaraNeural" },
  "es-ES": { male: "es-ES-AlvaroNeural", female: "es-ES-ElviraNeural" },
  "es-MX": { male: "es-MX-JorgeNeural", female: "es-MX-DaliaNeural" },
  "pt-BR": { male: "pt-BR-AntonioNeural", female: "pt-BR-FranciscaNeural" },
  "pt-PT": { male: "pt-PT-DuarteNeural", female: "pt-PT-RaquelNeural" },
  "de-DE": { male: "de-DE-ConradNeural", female: "de-DE-KatjaNeural" },
  "fr-FR": { male: "fr-FR-HenriNeural", female: "fr-FR-DeniseNeural" },
  "ar-SA": { male: "ar-SA-HamedNeural", female: "ar-SA-ZariyahNeural" },
  "it-IT": { male: "it-IT-DiegoNeural", female: "it-IT-ElsaNeural" },
  "tr-TR": { male: "tr-TR-AhmetNeural", female: "tr-TR-EmelNeural" },
  "ru-RU": { male: "ru-RU-DmitryNeural", female: "ru-RU-SvetlanaNeural" },
  "id-ID": { male: "id-ID-ArdiNeural", female: "id-ID-GadisNeural" },
};

function formatRateParam(rateInput?: any): string {
  if (!rateInput) return "+0%";
  if (typeof rateInput === "string") {
    if (rateInput.endsWith("%")) return rateInput;
    const num = parseFloat(rateInput);
    if (!isNaN(num)) {
      const pct = Math.round((num - 1.0) * 100);
      return pct >= 0 ? `+${pct}%` : `${pct}%`;
    }
    return rateInput;
  }
  if (typeof rateInput === "number") {
    const pct = Math.round((rateInput - 1.0) * 100);
    return pct >= 0 ? `+${pct}%` : `${pct}%`;
  }
  return "+0%";
}

// Generate Edge-TTS MP3 Buffer with fallback
async function generateEdgeTtsAudio(
  text: string,
  voiceName: string,
  rateStr: string = "+0%",
  pitchStr: string = "+0Hz"
): Promise<Buffer> {
  const cacheKey = getCacheKey(text, voiceName, rateStr, pitchStr);
  if (audioCache.has(cacheKey)) {
    return audioCache.get(cacheKey)!;
  }

  const tmpPath = path.join(os.tmpdir(), `edge-tts-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`);
  try {
    const tts = new EdgeTTS({
      voice: voiceName,
      rate: rateStr,
      pitch: pitchStr,
      timeout: 12000,
    });

    await tts.ttsPromise(text, tmpPath);
    const buffer = await fs.promises.readFile(tmpPath);

    // Save to in-memory cache
    if (audioCache.size >= MAX_CACHE_ITEMS) {
      const firstKey = audioCache.keys().next().value;
      if (firstKey) audioCache.delete(firstKey);
    }
    audioCache.set(cacheKey, buffer);

    return buffer;
  } finally {
    // Cleanup temporary file asynchronously
    fs.promises.unlink(tmpPath).catch(() => {});
    fs.promises.unlink(tmpPath + ".json").catch(() => {});
  }
}

// Initialize Gemini Client
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is missing.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
};

// Quiz Generation API endpoint
app.post("/api/generate-quiz", async (req, res) => {
  try {
    const { topic = "General Knowledge", count = 5, language = "English", difficulty = "Medium" } = req.body;

    const ai = getGeminiClient();

    const prompt = `Generate a high-quality multiple choice quiz with ${count} questions about "${topic}" in ${language}. Difficulty level: ${difficulty}. Each question must have exactly 4 options (A, B, C, D) and specify the correct option letter (A, B, C, or D). Ensure questions are engaging, clear, concise, and suitable for video quiz shows.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are an expert trivia quiz author for TV game shows. Always output valid JSON conforming to the requested schema.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          description: "List of quiz questions",
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING, description: "The question text" },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Array of 4 option texts corresponding to A, B, C, D",
              },
              answer: {
                type: Type.STRING,
                description: "The correct option letter: A, B, C, or D",
              },
              explanation: {
                type: Type.STRING,
                description: "Brief fun fact or explanation of the answer",
              },
            },
            required: ["question", "options", "answer"],
          },
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("Empty response from Gemini AI.");
    }

    const quizData = JSON.parse(text);
    return res.json({ success: true, quiz: quizData });
  } catch (error: any) {
    console.error("Quiz generation error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to generate quiz using AI.",
    });
  }
});

// ===========================================================================
// Free Neural Edge-TTS Endpoint (Human-like Voices without Paid API Keys)
// ===========================================================================
const handleTtsRequest = async (req: express.Request, res: express.Response) => {
  try {
    const isPost = req.method === "POST";
    const text = String(isPost ? req.body?.text || "" : req.query?.text || "").trim();
    const voiceInput = String(isPost ? req.body?.voice || req.body?.voice_name || "" : req.query?.voice || req.query?.voice_name || "").trim();
    const languageInput = String(isPost ? req.body?.language || req.body?.lang || "en-US" : req.query?.language || req.query?.lang || "en-US").trim();
    const genderInput = String(isPost ? req.body?.gender || "male" : req.query?.gender || "male").toLowerCase();
    const rateInput = isPost ? req.body?.rate : req.query?.rate;
    const pitchInput = String(isPost ? req.body?.pitch || "+0Hz" : req.query?.pitch || "+0Hz").trim();

    if (!text) {
      return res.status(400).json({ error: "Missing 'text' parameter." });
    }

    const cleanText = text.replace(/[*#_~]/g, "").slice(0, 800);
    const rateStr = formatRateParam(rateInput);
    const pitchStr = pitchInput.startsWith("+") || pitchInput.startsWith("-") ? pitchInput : `+${pitchInput}`;

    // Resolve Neural Voice Name
    let targetVoice = voiceInput;
    if (!targetVoice || !targetVoice.includes("Neural")) {
      const defaultForLang = DEFAULT_EDGE_VOICES[languageInput] || DEFAULT_EDGE_VOICES[languageInput.split("-")[0]] || DEFAULT_EDGE_VOICES["en-US"];
      if (genderInput === "female") {
        targetVoice = defaultForLang.female;
      } else {
        targetVoice = defaultForLang.male;
      }
    }

    // Try Microsoft Edge Neural TTS first
    try {
      const audioBuffer = await generateEdgeTtsAudio(cleanText, targetVoice, rateStr, pitchStr);
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.setHeader("X-TTS-Engine", "Microsoft-Edge-Neural");
      res.setHeader("X-TTS-Voice", targetVoice);
      return res.send(audioBuffer);
    } catch (edgeErr: any) {
      console.warn(`[EdgeTTS] Failed for voice ${targetVoice}: ${edgeErr?.message || edgeErr}. Falling back to secondary TTS...`);

      // Secondary Fallback: Google Translate TTS audio buffer
      const tl = languageInput.split("-")[0] || "en";
      const fallbackUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(
        cleanText.slice(0, 200)
      )}&tl=${encodeURIComponent(tl)}&client=tw-ob`;

      const response = await fetch(fallbackUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });

      if (!response.ok) {
        throw new Error(`TTS fallback also failed with status ${response.status}`);
      }

      const fallbackBuffer = Buffer.from(await response.arrayBuffer());
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.setHeader("X-TTS-Engine", "Google-Fallback");
      return res.send(fallbackBuffer);
    }
  } catch (error: any) {
    console.error("TTS endpoint error:", error);
    return res.status(500).json({ error: error.message || "Failed to synthesize neural audio." });
  }
};

app.post("/api/tts", handleTtsRequest);
app.get("/api/tts", handleTtsRequest);
app.post("/api/edge-tts", handleTtsRequest);
app.get("/api/edge-tts", handleTtsRequest);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Vite Middleware setup
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Quiz Video Generator Server running on http://0.0.0.0:${PORT}`);
  });
}

setupVite().catch((err) => {
  console.error("Failed to start server:", err);
});

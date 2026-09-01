import { VoiceLanguage, VoiceGender, VoicePersona } from '../types';
import { ALL_VOICE_LANGUAGES, VOICE_PERSONAS } from './ttsData';
import { getAudioContext, getAudioDestinationStream } from './audioEngine';

export { ALL_VOICE_LANGUAGES, VOICE_PERSONAS };

export interface TTSOptions {
  language: VoiceLanguage;
  gender: VoiceGender;
  voicePersonaId?: string;
  rate?: number;
  volume?: number;
}

// ---------------------------------------------------------------------------
// High Quality Neural Edge Voice Directory
// ---------------------------------------------------------------------------

const DEFAULT_NEURAL_VOICES: Record<VoiceLanguage, { male: string; female: string }> = {
  'en-US': { male: 'en-US-GuyNeural', female: 'en-US-JennyNeural' },
  'en-GB': { male: 'en-GB-RyanNeural', female: 'en-GB-SoniaNeural' },
  'en-IN': { male: 'en-IN-PrabhatNeural', female: 'en-IN-NeerjaNeural' },
  'ur-PK': { male: 'ur-PK-AsadNeural', female: 'ur-PK-UzmaNeural' },
  'hi-IN': { male: 'hi-IN-MadhurNeural', female: 'hi-IN-SwaraNeural' },
  'es-ES': { male: 'es-ES-AlvaroNeural', female: 'es-ES-ElviraNeural' },
  'es-MX': { male: 'es-MX-JorgeNeural', female: 'es-MX-DaliaNeural' },
  'pt-BR': { male: 'pt-BR-AntonioNeural', female: 'pt-BR-FranciscaNeural' },
  'pt-PT': { male: 'pt-PT-DuarteNeural', female: 'pt-PT-RaquelNeural' },
  'de-DE': { male: 'de-DE-ConradNeural', female: 'de-DE-KatjaNeural' },
  'fr-FR': { male: 'fr-FR-HenriNeural', female: 'fr-FR-DeniseNeural' },
  'ar-SA': { male: 'ar-SA-HamedNeural', female: 'ar-SA-ZariyahNeural' },
  'it-IT': { male: 'it-IT-DiegoNeural', female: 'it-IT-ElsaNeural' },
  'tr-TR': { male: 'tr-TR-AhmetNeural', female: 'tr-TR-EmelNeural' },
  'ru-RU': { male: 'ru-RU-DmitryNeural', female: 'ru-RU-SvetlanaNeural' },
  'id-ID': { male: 'id-ID-ArdiNeural', female: 'id-ID-GadisNeural' },
};

export function resolveEdgeVoice(language: VoiceLanguage, gender: VoiceGender, personaId?: string): string {
  const persona = findVoicePersonaById(personaId);
  if (persona?.edgeVoiceName) {
    return persona.edgeVoiceName;
  }

  const langEntry = DEFAULT_NEURAL_VOICES[language] || DEFAULT_NEURAL_VOICES['en-US'];
  if (gender === 'female') return langEntry.female;
  return langEntry.male;
}

export function getVoicePersonas(language: VoiceLanguage, gender?: VoiceGender): VoicePersona[] {
  const exact = VOICE_PERSONAS.filter(v => v.language === language && (!gender || v.gender === gender));
  if (exact.length > 0) return exact;

  const langPrefix = language.split('-')[0];
  const prefixMatches = VOICE_PERSONAS.filter(v => v.language.startsWith(langPrefix) && (!gender || v.gender === gender));
  if (prefixMatches.length > 0) return prefixMatches;

  return VOICE_PERSONAS.filter(v => !gender || v.gender === gender);
}

export function findVoicePersonaById(personaId?: string): VoicePersona | undefined {
  if (!personaId) return undefined;
  return VOICE_PERSONAS.find(p => p.id === personaId);
}

export function formatChemicalsAndAcronyms(text: string): string {
  if (!text) return '';

  let formatted = text;

  // Replace chemical formulas or compound codes (e.g. NaCl, H2O, CO2, NaOH, CaCO3, KMnO4, HCl)
  formatted = formatted.replace(/\b([A-Z][a-z]?\d*){2,}\b/g, (match) => {
    const capitalCount = (match.match(/[A-Z]/g) || []).length;
    const hasDigits = /\d/.test(match);

    if (capitalCount >= 2 || hasDigits) {
      return match
        .replace(/([A-Z])/g, ' $1')
        .replace(/([a-z])/g, ' $1')
        .replace(/(\d+)/g, ' $1')
        .toUpperCase()
        .replace(/\s+/g, ' ')
        .trim();
    }
    return match;
  });

  // Standalone 2-letter element symbols
  const elements2Letter = [
    'Na', 'Cl', 'Au', 'Ag', 'Fe', 'Cu', 'Zn', 'Mg', 'Ca', 'Pb', 'Hg', 'Al', 'Si',
    'He', 'Ne', 'Ar', 'Li', 'Be', 'Br', 'Ba', 'Ti', 'Cr', 'Mn', 'Co', 'Ni', 'Pt', 'Sn'
  ];
  const elemRegex = new RegExp(`\\b(${elements2Letter.join('|')})\\b`, 'g');
  formatted = formatted.replace(elemRegex, (m) => m.toUpperCase().split('').join(' '));

  return formatted;
}

// ---------------------------------------------------------------------------
// Client In-Memory Blob URL Cache & Audio Player Manager
// ---------------------------------------------------------------------------

const ttsBlobUrlCache = new Map<string, string>();
const pendingFetchMap = new Map<string, Promise<string>>();

let currentAudio: HTMLAudioElement | null = null;
let currentAbortController: AbortController | null = null;
let currentAudioSourceNode: MediaElementAudioSourceNode | null = null;

function getCacheKey(text: string, voice: string, rate: number): string {
  return `${voice}__${rate.toFixed(2)}__${text.trim()}`;
}

export async function fetchTtsAudioUrl(
  text: string,
  options: TTSOptions,
  signal?: AbortSignal
): Promise<string> {
  const persona = findVoicePersonaById(options.voicePersonaId);
  const targetGender = persona ? persona.gender : (options.gender || 'male');
  const targetVoice = resolveEdgeVoice(options.language, targetGender, options.voicePersonaId);
  const rawRate = options.rate || (persona?.playbackRateMultiplier || 1.0);
  const cleanText = formatChemicalsAndAcronyms(text).replace(/[*#_~]/g, '').trim();

  const cacheKey = getCacheKey(cleanText, targetVoice, rawRate);

  // 1. Return cached Blob URL immediately if available
  if (ttsBlobUrlCache.has(cacheKey)) {
    return ttsBlobUrlCache.get(cacheKey)!;
  }

  // 2. Share ongoing fetch promise if duplicate request is inflight
  if (pendingFetchMap.has(cacheKey)) {
    return pendingFetchMap.get(cacheKey)!;
  }

  const fetchPromise = (async () => {
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: cleanText,
          voice: targetVoice,
          language: options.language,
          gender: targetGender,
          rate: rawRate,
        }),
        signal,
      });

      if (!response.ok) {
        throw new Error(`TTS server responded with ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      // Cache locally
      ttsBlobUrlCache.set(cacheKey, blobUrl);
      return blobUrl;
    } finally {
      pendingFetchMap.delete(cacheKey);
    }
  })();

  pendingFetchMap.set(cacheKey, fetchPromise);
  return fetchPromise;
}

export function preloadTtsAudio(text: string, options: TTSOptions): Promise<string> {
  return fetchTtsAudioUrl(text, options);
}

// ---------------------------------------------------------------------------
// Speech Playback Controller (HTML5 Audio + WebAudio Stream integration)
// ---------------------------------------------------------------------------

export function speakText(
  text: string,
  options: TTSOptions,
  onEnd?: () => void,
  onError?: (err: any) => void
): () => void {
  if (typeof window === 'undefined') {
    onEnd?.();
    return () => {};
  }

  let isCancelled = false;
  let hasEnded = false;
  let safetyTimeoutId: any = null;

  const triggerEnd = () => {
    if (hasEnded || isCancelled) return;
    hasEnded = true;
    if (safetyTimeoutId) {
      clearTimeout(safetyTimeoutId);
      safetyTimeoutId = null;
    }
    currentAudio = null;
    onEnd?.();
  };

  cancelSpeech();

  // Safety maximum speech timeout based on text length (prevents hanging during bulk 40-question export)
  const maxWaitMs = Math.max(10000, text.length * 160);
  safetyTimeoutId = setTimeout(() => {
    if (!hasEnded && !isCancelled) {
      console.warn('[NeuralTTS] Safety timeout reached for speech item, proceeding to next stage.');
      triggerEnd();
    }
  }, maxWaitMs);

  const abortController = new AbortController();
  currentAbortController = abortController;

  fetchTtsAudioUrl(text, options, abortController.signal)
    .then((audioUrl) => {
      if (isCancelled || hasEnded) return;

      const audio = new Audio();
      audio.crossOrigin = 'anonymous';
      audio.src = audioUrl;
      audio.volume = options.volume !== undefined ? Math.max(0, Math.min(1, options.volume)) : 1.0;

      // Pipe to Web Audio Destination Stream if recording is active in VideoExporterModal
      try {
        const ctx = getAudioContext();
        if (ctx && ctx.state === 'running') {
          const dest = getAudioDestinationStream();
          const sourceNode = ctx.createMediaElementSource(audio);
          sourceNode.connect(ctx.destination);
          if (dest) {
            sourceNode.connect(dest);
          }
          currentAudioSourceNode = sourceNode;
        }
      } catch (e) {
        // Fallback: standard audio.play() still plays sound directly to speaker
      }

      audio.onended = () => {
        triggerEnd();
      };

      audio.onerror = (e) => {
        console.warn('[NeuralTTS] Audio playback error:', e);
        if (!isCancelled && !hasEnded) {
          onError?.(e);
          triggerEnd();
        }
      };

      currentAudio = audio;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          if (!isCancelled && err.name !== 'AbortError' && !hasEnded) {
            console.warn('[NeuralTTS] play() interrupted:', err);
            triggerEnd();
          }
        });
      }
    })
    .catch((err) => {
      if (!isCancelled && err.name !== 'AbortError' && !hasEnded) {
        console.warn('[NeuralTTS] Fetch error:', err);
        onError?.(err);
        triggerEnd();
      }
    });

  return () => {
    isCancelled = true;
    if (safetyTimeoutId) {
      clearTimeout(safetyTimeoutId);
      safetyTimeoutId = null;
    }
    cancelSpeech();
  };
}

export function playPersonaSample(
  persona: VoicePersona,
  volumeOrOptions?: number | { rate?: number; volume?: number },
  onEnd?: () => void
): () => void {
  const volume = typeof volumeOrOptions === 'number' ? volumeOrOptions : volumeOrOptions?.volume ?? 1.0;
  const userRate = typeof volumeOrOptions === 'object' ? volumeOrOptions.rate ?? 1.0 : 1.0;

  return speakText(
    persona.previewPhrase,
    {
      language: persona.language,
      gender: persona.gender,
      voicePersonaId: persona.id,
      rate: userRate,
      volume: volume,
    },
    onEnd
  );
}

export function playVoicePreview(
  persona: VoicePersona,
  volumeOrOptions?: number | { rate?: number; volume?: number },
  onEnd?: () => void
): () => void {
  return playPersonaSample(persona, volumeOrOptions, onEnd);
}

export function cancelSpeech(): void {
  if (currentAbortController) {
    try {
      currentAbortController.abort();
    } catch (e) {}
    currentAbortController = null;
  }

  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch (e) {}
    currentAudio = null;
  }

  if (currentAudioSourceNode) {
    try {
      currentAudioSourceNode.disconnect();
    } catch (e) {}
    currentAudioSourceNode = null;
  }
}

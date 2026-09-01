export type OptionLetter = 'A' | 'B' | 'C' | 'D';

export interface QuizItem {
  id: string;
  question: string;
  options: string[];
  answer: OptionLetter;
  explanation?: string;
  imageUrl?: string;
}

export type FontFamily = 'sans' | 'display' | 'serif' | 'mono' | 'impact';
export type FontSize = 'sm' | 'md' | 'lg' | 'xl' | '64px' | '70px';
export type TimerColor = 'green' | 'red' | 'blue' | 'yellow' | 'purple' | 'orange' | 'cyan';
export type TimerPosition = 'bottom-center' | 'top-right' | 'center' | 'bottom-bar';
export type MascotType = 'none' | 'blue-question' | 'brain-bot' | 'trophy' | 'gold-star' | 'custom';
export type QuizPlaybackState = 'idle' | 'intro' | 'reading' | 'countdown' | 'revealed' | 'reveal' | 'transitioning' | 'outro';

export interface QuizThemeConfig {
  canvasBg: string;
  bgPattern: 'none' | 'waves' | 'grid' | 'dots' | 'radial';
  questionBoxColor: string;
  questionBorderColor: string;
  questionTextColor: string;
  optionBoxColor: string;
  optionTextColor: string;
  optionBadgeColor: string;
  optionBadgeTextColor: string;
  correctHighlightColor: string;
  correctBadgeColor: string;
  fontFamily: FontFamily;
  fontSize: FontSize;
  timerColor: TimerColor;
  timerPosition: TimerPosition;
  timerDuration: number;
  mascotType: MascotType;
  customMascotUrl: string | null;
  revealDelay: number;
  enableTypewriter?: boolean;
  typewriterSpeed?: 'slow' | 'normal' | 'fast' | 'ultra' | 'custom';
  typewriterSpeedMs?: number;
  questionAlign?: 'left' | 'center';
  enableRevealEmoji?: boolean;
  correctRevealEmoji?: string;
}

export type VoiceLanguage =
  | 'en-US'
  | 'en-GB'
  | 'en-IN'
  | 'ur-PK'
  | 'hi-IN'
  | 'es-ES'
  | 'es-MX'
  | 'pt-BR'
  | 'pt-PT'
  | 'de-DE'
  | 'fr-FR'
  | 'ar-SA'
  | 'it-IT'
  | 'tr-TR'
  | 'ru-RU'
  | 'id-ID';

export type VoiceGender = 'male' | 'female';

export interface VoicePersona {
  id: string;
  name: string;
  gender: VoiceGender;
  language: VoiceLanguage;
  languageLabel: string;
  flag: string;
  accent: string;
  description: string;
  pitchShiftCents?: number;
  playbackRateMultiplier?: number;
  formantType?: 'deep-male' | 'standard-male' | 'melodious-female' | 'crisp-female' | 'bright-female';
  previewPhrase: string;
  edgeVoiceName?: string;
}

export interface AudioConfig {
  language: VoiceLanguage;
  voiceGender: VoiceGender;
  voicePersonaId?: string;
  speechRate: number;
  enableTTS: boolean;
  enableBeepSound: boolean;
  enableFanfareSound: boolean;
  enableTypewriterSound?: boolean;
  typewriterVolume?: number;
  typewriterSoundPreset?: 'mechanical' | 'laptop' | 'clicky' | 'custom';
  typewriterSpeedMs?: number;
  customTypewriterSoundUrl?: string | null;
  customTimerSoundUrl?: string | null;
  customAnswerSoundUrl?: string | null;
  bgMusicUrl?: string | null;
  bgMusicVolume?: number;
  timerVolume?: number;
  answerVolume?: number;
  enableBgMusic?: boolean;
  enableDucking?: boolean;
  volume: number;
}

export interface IntroOutroConfig {
  enableIntro: boolean;
  introVideoUrl?: string | null;
  introTitle: string;
  introSubtitle?: string;
  introDuration: number;
  enableOutro: boolean;
  outroVideoUrl?: string | null;
  outroTitle: string;
  outroCallToAction?: string;
  outroDuration: number;
}

export interface StoredAudioTrack {
  id: string;
  name: string;
  type: 'bgMusic' | 'timer' | 'answer' | 'typewriter' | 'general';
  dataUrl: string;
  fileSizeStr: string;
  uploadedAt: number;
}

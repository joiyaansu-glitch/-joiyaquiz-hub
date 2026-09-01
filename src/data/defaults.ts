import { QuizItem, QuizThemeConfig, AudioConfig, IntroOutroConfig } from '../types';

export const INITIAL_QUIZ_ITEMS: QuizItem[] = [
  {
    id: '1',
    question: 'What is the first letter of the Greek alphabet?',
    options: ['Beta', 'Sigma', 'Alpha', 'Omega'],
    answer: 'C',
    explanation: 'Alpha is the first letter of the Greek alphabet, derived from the Phoenician letter aleph.'
  },
  {
    id: '2',
    question: 'Which planet in our solar system is known as the Red Planet?',
    options: ['Venus', 'Mars', 'Jupiter', 'Saturn'],
    answer: 'B',
    explanation: 'Mars appears red because of iron oxide (rust) on its surface.'
  },
  {
    id: '3',
    question: 'What is the chemical symbol for Gold?',
    options: ['Au', 'Ag', 'Fe', 'Cu'],
    answer: 'A',
    explanation: 'Au comes from the Latin word for gold, "Aurum", meaning shining dawn.'
  },
  {
    id: '4',
    question: 'Which element makes up roughly 78% of Earth\'s atmosphere?',
    options: ['Oxygen', 'Carbon Dioxide', 'Nitrogen', 'Argon'],
    answer: 'C',
    explanation: 'Nitrogen gas (N2) forms about 78% of Earth\'s atmosphere by volume.'
  },
  {
    id: '5',
    question: 'How many continents are there on planet Earth?',
    options: ['5', '6', '7', '8'],
    answer: 'C',
    explanation: 'The 7 continents are Africa, Antarctica, Asia, Australia, Europe, North America, and South America.'
  }
];

export const DEFAULT_THEME_CONFIG: QuizThemeConfig = {
  canvasBg: '#d0d5dd', // Glossy metallic silver/gray matching image
  bgPattern: 'waves',
  questionBoxColor: '#ff6b00', // Glossy TV orange matching image
  questionBorderColor: '#1e293b',
  questionTextColor: '#ffffff',
  optionBoxColor: '#22c55e', // Glossy green option box matching image
  optionTextColor: '#000000',
  optionBadgeColor: '#ff6b00', // Glossy orange circle badge matching image
  optionBadgeTextColor: '#000000',
  correctHighlightColor: '#fbbf24', // Glowing golden yellow highlight on reveal
  correctBadgeColor: '#eab308',
  fontFamily: 'sans',
  fontSize: 'md',
  timerColor: 'green',
  timerPosition: 'bottom-center',
  timerDuration: 10,
  mascotType: 'blue-question',
  customMascotUrl: null,
  revealDelay: 3,
  enableTypewriter: true,
  typewriterSpeed: 'normal',
  typewriterSpeedMs: 26,
  questionAlign: 'left',
  enableRevealEmoji: true,
  correctRevealEmoji: '🎉',
};

export const DEFAULT_AUDIO_CONFIG: AudioConfig = {
  language: 'en-US',
  voiceGender: 'male',
  voicePersonaId: 'en-us-male-1',
  speechRate: 1.1,
  enableTTS: true,
  enableBeepSound: true,
  enableFanfareSound: true,
  enableTypewriterSound: true,
  typewriterVolume: 0.6,
  typewriterSpeedMs: 26,
  customTypewriterSoundUrl: null,
  customTimerSoundUrl: null,
  customAnswerSoundUrl: null,
  bgMusicUrl: null,
  bgMusicVolume: 0.18,
  timerVolume: 0.7,
  answerVolume: 0.8,
  enableBgMusic: true,
  enableDucking: true,
  volume: 0.8,
};

export const DEFAULT_INTRO_OUTRO_CONFIG: IntroOutroConfig = {
  enableIntro: true,
  introVideoUrl: null,
  introDuration: 3,
  introTitle: 'WELCOME TO THE ULTIMATE QUIZ SHOW!',
  enableOutro: true,
  outroVideoUrl: null,
  outroDuration: 3,
  outroTitle: 'THANKS FOR PLAYING! LIKE & SUBSCRIBE!',
};

export const PRESET_THEMES: { name: string; theme: Partial<QuizThemeConfig> }[] = [
  {
    name: 'Classic TV Game Show',
    theme: {
      canvasBg: '#d0d5dd',
      bgPattern: 'waves',
      questionBoxColor: '#ff6b00',
      questionTextColor: '#ffffff',
      optionBoxColor: '#22c55e',
      optionTextColor: '#000000',
      optionBadgeColor: '#ff6b00',
      timerColor: 'green',
      mascotType: 'blue-question'
    }
  },
  {
    name: 'Cyberpunk Neon',
    theme: {
      canvasBg: '#0f172a',
      bgPattern: 'grid',
      questionBoxColor: '#06b6d4',
      questionTextColor: '#ffffff',
      optionBoxColor: '#8b5cf6',
      optionTextColor: '#ffffff',
      optionBadgeColor: '#ec4899',
      timerColor: 'cyan',
      mascotType: 'brain-bot'
    }
  },
  {
    name: 'Golden Luxury',
    theme: {
      canvasBg: '#1c1917',
      bgPattern: 'dots',
      questionBoxColor: '#d97706',
      questionTextColor: '#ffffff',
      optionBoxColor: '#ca8a04',
      optionTextColor: '#ffffff',
      optionBadgeColor: '#eab308',
      timerColor: 'yellow',
      mascotType: 'trophy'
    }
  },
  {
    name: 'Red Alert Quiz',
    theme: {
      canvasBg: '#e2e8f0',
      bgPattern: 'waves',
      questionBoxColor: '#dc2626',
      questionTextColor: '#ffffff',
      optionBoxColor: '#0284c7',
      optionTextColor: '#ffffff',
      optionBadgeColor: '#ef4444',
      timerColor: 'red',
      mascotType: 'gold-star'
    }
  }
];

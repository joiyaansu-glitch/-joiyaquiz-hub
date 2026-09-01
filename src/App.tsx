import React, { useState, useEffect, useRef } from 'react';
import {
  Film,
  Layers,
  Palette,
  Volume2,
  Tv,
} from 'lucide-react';

import { QuizItem, QuizThemeConfig, AudioConfig, QuizPlaybackState, IntroOutroConfig } from './types';
import { INITIAL_QUIZ_ITEMS, DEFAULT_THEME_CONFIG, DEFAULT_AUDIO_CONFIG, DEFAULT_INTRO_OUTRO_CONFIG } from './data/defaults';
import { QuizCanvas } from './components/QuizCanvas';
import { QuizListEditor } from './components/QuizListEditor';
import { ThemeCustomizer } from './components/ThemeCustomizer';
import { AudioCustomizer } from './components/AudioCustomizer';
import { PlayerControls } from './components/PlayerControls';
import { TimelineEditor } from './components/TimelineEditor';
import { VideoExporterModal } from './components/VideoExporterModal';

import { speakText, cancelSpeech } from './utils/ttsEngine';
import {
  playCountdownBeep,
  playVictoryFanfare,
  stopTimerAudio,
  preloadCustomAudio,
  startBackgroundMusic,
  stopBackgroundMusic,
  duckBackgroundMusic,
  playIntroMediaAudio,
  playOutroMediaAudio,
  stopIntroOutroAudio
} from './utils/audioEngine';
import { getStoredAudioTracks } from './utils/audioStorage';

export default function App() {
  const [questions, setQuestions] = useState<QuizItem[]>(INITIAL_QUIZ_ITEMS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [theme, setTheme] = useState<QuizThemeConfig>(DEFAULT_THEME_CONFIG);
  const [audioConfig, setAudioConfig] = useState<AudioConfig>(DEFAULT_AUDIO_CONFIG);
  const [introOutro, setIntroOutro] = useState<IntroOutroConfig>(DEFAULT_INTRO_OUTRO_CONFIG);

  const [playbackState, setPlaybackState] = useState<QuizPlaybackState>('idle');
  const [timerSeconds, setTimerSeconds] = useState(DEFAULT_THEME_CONFIG.timerDuration);
  const [autoLoop, setAutoLoop] = useState(true);

  const [activeTab, setActiveTab] = useState<'questions' | 'theme' | 'audio'>('questions');
  const [isVideoExportOpen, setIsVideoExportOpen] = useState(false);

  const canvasElementRef = useRef<HTMLCanvasElement | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const sequenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const currentQuestion = questions[currentIndex] || null;

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (sequenceTimeoutRef.current) clearTimeout(sequenceTimeoutRef.current);
      cancelSpeech();
    };
  }, []);

  // Update timer seconds when theme changes
  useEffect(() => {
    if (playbackState === 'idle') {
      setTimerSeconds(theme.timerDuration);
    }
  }, [theme.timerDuration, playbackState]);

  // Sequence Controller Logic
  const stopSequence = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (sequenceTimeoutRef.current) clearTimeout(sequenceTimeoutRef.current);
    cancelSpeech();
    stopTimerAudio();
    stopBackgroundMusic();
    stopIntroOutroAudio();
    setPlaybackState('idle');
    setTimerSeconds(theme.timerDuration);
  };

  const startIntroSequence = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (sequenceTimeoutRef.current) clearTimeout(sequenceTimeoutRef.current);
    cancelSpeech();
    stopTimerAudio();
    stopBackgroundMusic(); // Ensure background music is SILENT during intro clip
    stopIntroOutroAudio();

    setPlaybackState('intro');
    setCurrentIndex(0);
    setTimerSeconds(theme.timerDuration);

    if (introOutro.introVideoUrl) {
      playIntroMediaAudio(introOutro.introVideoUrl, audioConfig.volume ?? 0.8);
    }

    const durationSec = Math.max(1, introOutro.introDuration || 3);
    sequenceTimeoutRef.current = setTimeout(() => {
      stopIntroOutroAudio();
      startQuestionSequence(0, true);
    }, durationSec * 1000);
  };

  const startOutroSequence = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (sequenceTimeoutRef.current) clearTimeout(sequenceTimeoutRef.current);
    cancelSpeech();
    stopTimerAudio();
    stopBackgroundMusic(); // Stop background music so outro sound plays clearly
    stopIntroOutroAudio();

    setPlaybackState('outro');

    if (introOutro.outroVideoUrl) {
      playOutroMediaAudio(introOutro.outroVideoUrl, audioConfig.volume ?? 0.8);
    }

    const durationSec = Math.max(1, introOutro.outroDuration || 3);
    sequenceTimeoutRef.current = setTimeout(() => {
      stopIntroOutroAudio();
      if (autoLoop) {
        if (introOutro.enableIntro) {
          startIntroSequence();
        } else {
          startQuestionSequence(0, true);
        }
      } else {
        stopBackgroundMusic();
        setPlaybackState('idle');
      }
    }, durationSec * 1000);
  };

  const startQuestionSequence = (targetIndex: number, isTransition = false) => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (sequenceTimeoutRef.current) clearTimeout(sequenceTimeoutRef.current);
    cancelSpeech();
    stopTimerAudio();

    const item = questions[targetIndex];
    if (!item) {
      stopSequence();
      return;
    }

    if (isTransition) {
      // 1-second transition animation: previous question disappears, new question appears
      setPlaybackState('transitioning');
      setCurrentIndex(targetIndex);
      setTimerSeconds(theme.timerDuration);

      sequenceTimeoutRef.current = setTimeout(() => {
        proceedToQuestionReading(targetIndex);
      }, 1000);
      return;
    }

    setCurrentIndex(targetIndex);
    proceedToQuestionReading(targetIndex);
  };

  const proceedToQuestionReading = (targetIndex: number) => {
    const item = questions[targetIndex];
    if (!item) return;

    setPlaybackState('reading');
    setTimerSeconds(theme.timerDuration);

    if (audioConfig.enableBgMusic !== false) {
      startBackgroundMusic(
        audioConfig.bgMusicUrl,
        audioConfig.bgMusicVolume ?? 0.18,
        audioConfig.volume ?? 0.8
      );
    }

    if (audioConfig.enableTTS) {
      if (audioConfig.enableDucking !== false) {
        duckBackgroundMusic(true, (audioConfig.bgMusicVolume ?? 0.18) * (audioConfig.volume ?? 0.8));
      }
      const narrationText = `${item.question}`;
      speakText(
        narrationText,
        {
          language: audioConfig.language,
          gender: audioConfig.voiceGender,
          voicePersonaId: audioConfig.voicePersonaId,
          rate: Math.max(1.1, audioConfig.speechRate),
          volume: audioConfig.volume,
        },
        () => {
          if (audioConfig.enableDucking !== false) {
            duckBackgroundMusic(false, (audioConfig.bgMusicVolume ?? 0.18) * (audioConfig.volume ?? 0.8));
          }
          // TTS finished -> Start Countdown Timer
          beginCountdown(targetIndex);
        }
      );
    } else {
      // Immediate Countdown if TTS disabled
      sequenceTimeoutRef.current = setTimeout(() => {
        beginCountdown(targetIndex);
      }, 1000);
    }
  };

  // Restore latest saved audio tracks from library on initial mount if available
  useEffect(() => {
    getStoredAudioTracks().then((tracks) => {
      if (tracks.length === 0) return;
      const latestBg = tracks.find(t => t.type === 'bgMusic');
      const latestTimer = tracks.find(t => t.type === 'timer');
      const latestAnswer = tracks.find(t => t.type === 'answer');

      setAudioConfig(prev => ({
        ...prev,
        bgMusicUrl: prev.bgMusicUrl || (latestBg ? latestBg.dataUrl : null),
        customTimerSoundUrl: prev.customTimerSoundUrl || (latestTimer ? latestTimer.dataUrl : null),
        customAnswerSoundUrl: prev.customAnswerSoundUrl || (latestAnswer ? latestAnswer.dataUrl : null),
      }));
    });
  }, []);

  // Preload custom audio when configured
  useEffect(() => {
    if (audioConfig.bgMusicUrl) {
      preloadCustomAudio(audioConfig.bgMusicUrl);
    }
    if (audioConfig.customTimerSoundUrl) {
      preloadCustomAudio(audioConfig.customTimerSoundUrl);
    }
    if (audioConfig.customAnswerSoundUrl) {
      preloadCustomAudio(audioConfig.customAnswerSoundUrl);
    }
  }, [audioConfig.bgMusicUrl, audioConfig.customTimerSoundUrl, audioConfig.customAnswerSoundUrl]);

  const beginCountdown = (targetIndex: number) => {
    setPlaybackState('countdown');
    const totalDuration = theme.timerDuration || 10;
    let sec = totalDuration;
    setTimerSeconds(sec);

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    // Stop previous timer sound if any
    stopTimerAudio();

    // If using continuous custom timer sound track, trigger playback at start of countdown
    if (audioConfig.enableBeepSound && audioConfig.customTimerSoundUrl) {
      playCountdownBeep(
        audioConfig.volume,
        false,
        audioConfig.customTimerSoundUrl,
        true,
        audioConfig.timerVolume ?? 0.7
      );
    }

    timerIntervalRef.current = setInterval(() => {
      sec -= 1;
      setTimerSeconds(sec);

      // Play synthesized beep per elapsed second (exactly N beeps for N seconds timer)
      if (audioConfig.enableBeepSound && !audioConfig.customTimerSoundUrl) {
        playCountdownBeep(
          audioConfig.volume,
          sec <= 1,
          null,
          false,
          audioConfig.timerVolume ?? 0.7
        );
      }

      if (sec <= 0) {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        stopTimerAudio();
        triggerReveal(targetIndex);
      }
    }, 1000);
  };

  const triggerReveal = (targetIndex: number) => {
    stopTimerAudio();
    setPlaybackState('reveal');
    if (audioConfig.enableFanfareSound) {
      playVictoryFanfare(
        audioConfig.volume,
        audioConfig.customAnswerSoundUrl,
        audioConfig.answerVolume ?? 0.8
      );
    }

    const item = questions[targetIndex];
    let correctLetter = String(item?.answer || 'A').trim().toUpperCase().charAt(0);
    if (!['A', 'B', 'C', 'D'].includes(correctLetter)) {
      correctLetter = 'A';
    }
    const letterIdx = ['A', 'B', 'C', 'D'].indexOf(correctLetter);
    const correctOptionText = item ? item.options[letterIdx] || '' : '';

    if (item && audioConfig.enableTTS) {
      if (audioConfig.enableDucking !== false) {
        duckBackgroundMusic(true, (audioConfig.bgMusicVolume ?? 0.18) * (audioConfig.volume ?? 0.8));
      }
      const answerTTS = item.explanation
        ? `The correct answer is Option ${correctLetter}: ${correctOptionText}. ${item.explanation}`
        : `The correct answer is Option ${correctLetter}: ${correctOptionText}.`;
      speakText(
        answerTTS,
        {
          language: audioConfig.language,
          gender: audioConfig.voiceGender,
          voicePersonaId: audioConfig.voicePersonaId,
          rate: Math.max(1.1, audioConfig.speechRate),
          volume: audioConfig.volume,
        },
        () => {
          if (audioConfig.enableDucking !== false) {
            duckBackgroundMusic(false, (audioConfig.bgMusicVolume ?? 0.18) * (audioConfig.volume ?? 0.8));
          }
          sequenceTimeoutRef.current = setTimeout(() => {
            if (targetIndex < questions.length - 1) {
              startQuestionSequence(targetIndex + 1, true);
            } else if (introOutro.enableOutro) {
              startOutroSequence();
            } else if (autoLoop) {
              if (introOutro.enableIntro) {
                startIntroSequence();
              } else {
                startQuestionSequence(0, true);
              }
            } else {
              stopBackgroundMusic();
              setPlaybackState('idle');
            }
          }, 1000);
        }
      );
    } else {
      // After reveal delay, move to next question or end
      sequenceTimeoutRef.current = setTimeout(() => {
        if (targetIndex < questions.length - 1) {
          startQuestionSequence(targetIndex + 1, true);
        } else if (introOutro.enableOutro) {
          startOutroSequence();
        } else if (autoLoop) {
          if (introOutro.enableIntro) {
            startIntroSequence();
          } else {
            startQuestionSequence(0, true);
          }
        } else {
          stopBackgroundMusic();
          setPlaybackState('idle');
        }
      }, theme.revealDelay * 1000);
    }
  };

  const handleTogglePlay = () => {
    if (playbackState !== 'idle') {
      stopSequence();
    } else {
      if (currentIndex === 0 && introOutro.enableIntro) {
        startIntroSequence();
      } else {
        const startIndex = currentIndex >= questions.length - 1 ? 0 : currentIndex;
        startQuestionSequence(startIndex);
      }
    }
  };

  const handlePrev = () => {
    stopSequence();
    const nextIdx = Math.max(0, currentIndex - 1);
    setCurrentIndex(nextIdx);
  };

  const handleNext = () => {
    stopSequence();
    const nextIdx = Math.min(questions.length - 1, currentIndex + 1);
    setCurrentIndex(nextIdx);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      {/* Top Application Header */}
      <header className="h-14 bg-[#121217] border-b border-white/5 sticky top-0 z-30 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center font-black italic text-white text-lg shadow-md shadow-indigo-600/30">
            Q
          </div>
          <div>
            <h1 className="font-black tracking-tighter text-xl uppercase flex items-center gap-2 text-white">
              JoiyaQuiz <span className="text-indigo-500 underline decoration-2">Hub</span>
              <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                1080p Studio
              </span>
            </h1>
          </div>
        </div>

        {/* Top Header Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              stopSequence();
              setIsVideoExportOpen(true);
            }}
            className="px-5 py-2 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-widest transition flex items-center gap-2 shadow-lg shadow-indigo-600/25 active:scale-95"
          >
            <Film className="w-4 h-4" /> Export Video
          </button>
        </div>
      </header>

      {/* Main Studio Body Grid */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-6 bg-[#0f0f12]">
        {/* LEFT COLUMN: Controls & Settings Panel (5 cols) */}
        <div className="lg:col-span-5 space-y-4 flex flex-col">
          {/* Navigation Tabs */}
          <div className="flex items-center gap-1.5 p-1.5 bg-[#121217] rounded-xl border border-white/5">
            <button
              onClick={() => setActiveTab('questions')}
              className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition flex items-center justify-center gap-2 ${
                activeTab === 'questions'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                  : 'text-white/40 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> Questions
            </button>
            <button
              onClick={() => setActiveTab('theme')}
              className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition flex items-center justify-center gap-2 ${
                activeTab === 'theme'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                  : 'text-white/40 hover:text-white'
              }`}
            >
              <Palette className="w-3.5 h-3.5" /> Aesthetics
            </button>
            <button
              onClick={() => setActiveTab('audio')}
              className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition flex items-center justify-center gap-2 ${
                activeTab === 'audio'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                  : 'text-white/40 hover:text-white'
              }`}
            >
              <Volume2 className="w-3.5 h-3.5" /> Narrator
            </button>
          </div>

          {/* Tab Content Panels */}
          <div className="flex-1">
            {activeTab === 'questions' && (
              <QuizListEditor
                questions={questions}
                onChange={setQuestions}
                currentIndex={currentIndex}
                onSelectIndex={idx => {
                  stopSequence();
                  setCurrentIndex(idx);
                }}
              />
            )}

            {activeTab === 'theme' && (
              <ThemeCustomizer theme={theme} onChange={setTheme} />
            )}

            {activeTab === 'audio' && (
              <AudioCustomizer config={audioConfig} onChange={setAudioConfig} />
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Live Video Stage Preview & Player (7 cols) */}
        <div className="lg:col-span-7 space-y-4 flex flex-col">
          {/* Section Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-white/40 flex items-center gap-2">
              <Tv className="w-4 h-4 text-indigo-500" /> Studio Canvas Preview (16:9 1080p)
            </h2>
            <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 bg-indigo-600/10 px-2 py-0.5 rounded border border-indigo-500/20">
              Bold Typography Theme
            </span>
          </div>

          {/* Interactive HTML5 Widescreen Canvas */}
          <div className="relative rounded-2xl overflow-hidden shadow-[0_0_80px_rgba(79,70,229,0.15)] border border-white/10 bg-[#0a0a0c]">
            <QuizCanvas
              question={currentQuestion}
              questionIndex={currentIndex}
              totalQuestions={questions.length}
              theme={theme}
              playbackState={playbackState}
              timerSeconds={timerSeconds}
              audioConfig={audioConfig}
              introOutro={introOutro}
              onCanvasRef={c => {
                canvasElementRef.current = c;
              }}
            />
          </div>

          {/* Interactive Player Controls Bar */}
          <PlayerControls
            playbackState={playbackState}
            onTogglePlay={handleTogglePlay}
            onPrev={handlePrev}
            onNext={handleNext}
            onStartCountdown={beginCountdown}
            onRevealAnswer={triggerReveal}
            currentIndex={currentIndex}
            totalQuestions={questions.length}
            timerSeconds={timerSeconds}
            autoLoop={autoLoop}
            onToggleAutoLoop={() => setAutoLoop(!autoLoop)}
          />

          {/* Multi-Track Interactive Video Sequence Timeline */}
          <TimelineEditor
            questions={questions}
            currentIndex={currentIndex}
            onSelectQuestion={idx => {
              stopSequence();
              setCurrentIndex(idx);
            }}
            theme={theme}
            audioConfig={audioConfig}
            introOutro={introOutro}
            onUpdateIntroOutro={setIntroOutro}
            playbackState={playbackState}
            timerSeconds={timerSeconds}
            onScrubTo={qIdx => {
              stopSequence();
              setCurrentIndex(qIdx);
            }}
          />
        </div>
      </main>

      {/* Video Exporter Modal */}
      <VideoExporterModal
        isOpen={isVideoExportOpen}
        onClose={() => setIsVideoExportOpen(false)}
        questions={questions}
        theme={theme}
        audioConfig={audioConfig}
        introOutro={introOutro}
        getCanvasElement={() => canvasElementRef.current}
        setCurrentQuestionIndex={setCurrentIndex}
        setPlaybackState={setPlaybackState}
        setTimerSeconds={setTimerSeconds}
      />
    </div>
  );
}

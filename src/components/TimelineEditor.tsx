import React, { useRef, useState, useEffect } from 'react';
import { Video, Music, Mic, Zap, Upload, Play, Trash2, Plus, Film, Sliders, ChevronRight } from 'lucide-react';
import { QuizItem, QuizThemeConfig, AudioConfig, IntroOutroConfig, QuizPlaybackState } from '../types';
import { preloadCustomAudio } from '../utils/audioEngine';

interface TimelineEditorProps {
  questions: QuizItem[];
  currentIndex: number;
  onSelectQuestion: (index: number) => void;
  theme: QuizThemeConfig;
  audioConfig: AudioConfig;
  introOutro: IntroOutroConfig;
  onUpdateIntroOutro: (config: IntroOutroConfig) => void;
  playbackState: QuizPlaybackState;
  timerSeconds: number;
  onScrubTo: (questionIndex: number) => void;
}

export const TimelineEditor: React.FC<TimelineEditorProps> = ({
  questions,
  currentIndex,
  onSelectQuestion,
  theme,
  audioConfig,
  introOutro,
  onUpdateIntroOutro,
  playbackState,
  timerSeconds,
  onScrubTo,
}) => {
  const timelineRef = useRef<HTMLDivElement>(null);

  // Calculate estimated total video duration.
  // Previously this used a fixed "3 seconds" guess for every question's narration
  // regardless of its actual length, and ignored the explanation text entirely —
  // so longer quizzes (e.g. 30 questions with real explanations) showed a much
  // shorter estimate here than the video actually turned out to be. This now
  // estimates narration time from the real question/option/explanation text
  // length at a natural speaking pace (~0.06s per character), matching how long
  // the TTS narration actually takes for both the question and the answer-reveal.
  const estimateNarrationSeconds = (text: string) => 1 + (text || '').length * 0.06;
  const perQuestionDuration = questions.length > 0
    ? questions.reduce((sum, q) => {
        const correctIdx = ['A', 'B', 'C', 'D'].indexOf(q.answer || 'A');
        const correctOptionText = q.options?.[correctIdx] || '';
        const revealText = `The correct answer is Option ${q.answer || 'A'}: ${correctOptionText}. ${q.explanation || ''}`;
        const questionNarrationSec = estimateNarrationSeconds(q.question);
        const revealNarrationSec = estimateNarrationSeconds(revealText);
        // question narration + countdown timer + reveal narration + reveal pause + ~1s transition buffer
        return sum + questionNarrationSec + theme.timerDuration + revealNarrationSec + theme.revealDelay + 1;
      }, 0) / questions.length
    : 3 + theme.timerDuration + theme.revealDelay;
  const introDur = introOutro.enableIntro ? introOutro.introDuration : 0;
  const outroDur = introOutro.enableOutro ? introOutro.outroDuration : 0;
  const totalDuration = introDur + (questions.length * perQuestionDuration) + outroDur;

  // --- Smooth playhead tracking -------------------------------------------
  // Previously the playhead only moved when `timerSeconds` ticked down once a
  // second, and it stayed completely frozen for however long the question's
  // narration took (since timerSeconds doesn't start counting down until AFTER
  // narration finishes) — then it jumped straight to the next question. This
  // tracks real wall-clock time within each phase (narration → countdown →
  // reveal) and re-renders every ~100ms so the playhead glides continuously
  // through the whole question instead of freezing and jumping.
  const phaseStartRef = useRef<number>(performance.now());
  const phaseKeyRef = useRef<string>('');
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => setTick((t) => (t + 1) % 1000000), 100);
    return () => window.clearInterval(interval);
  }, []);

  const currentQuestion = questions[currentIndex];
  const phaseKey = `${currentIndex}:${playbackState}`;
  if (phaseKeyRef.current !== phaseKey) {
    phaseKeyRef.current = phaseKey;
    phaseStartRef.current = performance.now();
  }
  const phaseElapsedSec = Math.max(0, (performance.now() - phaseStartRef.current) / 1000);

  let offsetWithinQuestion = 0;
  let phaseDurationEstimate = 1;

  if (currentQuestion) {
    const questionNarrationSec = estimateNarrationSeconds(currentQuestion.question);
    const correctIdx = ['A', 'B', 'C', 'D'].indexOf(currentQuestion.answer || 'A');
    const correctOptionText = currentQuestion.options?.[correctIdx] || '';
    const revealText = `The correct answer is Option ${currentQuestion.answer || 'A'}: ${correctOptionText}. ${currentQuestion.explanation || ''}`;
    const revealNarrationSec = estimateNarrationSeconds(revealText);

    switch (playbackState) {
      case 'reading':
        offsetWithinQuestion = 0;
        phaseDurationEstimate = questionNarrationSec;
        break;
      case 'countdown':
        offsetWithinQuestion = questionNarrationSec;
        // timerSeconds itself already ticks down once a second during this phase,
        // so use it directly (it's more accurate than a time-based estimate here).
        phaseDurationEstimate = theme.timerDuration;
        break;
      case 'reveal':
      case 'revealed':
        offsetWithinQuestion = questionNarrationSec + theme.timerDuration;
        phaseDurationEstimate = revealNarrationSec + theme.revealDelay;
        break;
      case 'transitioning':
      default:
        offsetWithinQuestion = 0;
        phaseDurationEstimate = 1;
        break;
    }
  }

  // Calculate active playhead position
  const activeQuestionOffset = introDur + (currentIndex * perQuestionDuration);
  const withinPhaseProgress = playbackState === 'countdown'
    ? (theme.timerDuration - timerSeconds)
    : Math.min(phaseDurationEstimate, phaseElapsedSec);
  const currentElapsed = playbackState === 'intro'
    ? Math.min(introDur, phaseElapsedSec)
    : playbackState === 'outro'
    ? introDur + (questions.length * perQuestionDuration) + Math.min(outroDur, phaseElapsedSec)
    : activeQuestionOffset + offsetWithinQuestion + withinPhaseProgress;
  const playheadPercent = Math.min(100, Math.max(0, (currentElapsed / Math.max(1, totalDuration)) * 100));

  // File upload handlers for intro and outro
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'intro' | 'outro') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    preloadCustomAudio(url);
    const tempVid = document.createElement('video');
    tempVid.src = url;
    tempVid.onloadedmetadata = () => {
      const dur = Math.max(1, Math.min(60, Math.round(tempVid.duration || 3)));
      if (type === 'intro') {
        onUpdateIntroOutro({ ...introOutro, introVideoUrl: url, enableIntro: true, introDuration: dur });
      } else {
        onUpdateIntroOutro({ ...introOutro, outroVideoUrl: url, enableOutro: true, outroDuration: dur });
      }
    };
    if (type === 'intro') {
      onUpdateIntroOutro({ ...introOutro, introVideoUrl: url, enableIntro: true });
    } else {
      onUpdateIntroOutro({ ...introOutro, outroVideoUrl: url, enableOutro: true });
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const targetTimeSec = ratio * totalDuration;

    // Determine which question or intro/outro corresponds to targetTimeSec
    if (targetTimeSec < introDur) {
      onSelectQuestion(0);
    } else {
      const relativeTime = targetTimeSec - introDur;
      const qIdx = Math.min(questions.length - 1, Math.floor(relativeTime / perQuestionDuration));
      onScrubTo(qIdx);
    }
  };

  return (
    <div className="bg-[#121217] border border-white/10 rounded-2xl p-4 text-white shadow-2xl space-y-4">
      {/* Top Bar: Timeline Title & Info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
            <Film className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-white">Video Sequence Timeline</h3>
            <p className="text-[10px] text-white/40">Multi-track video scrubbing & clip arranger</p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono font-bold bg-[#0a0a0c] px-3 py-1.5 rounded-xl border border-white/5 text-indigo-400">
          <span>{formatTime(currentElapsed)}</span>
          <span className="text-white/20">/</span>
          <span className="text-white/60">{formatTime(totalDuration)}</span>
        </div>
      </div>

      {/* Intro & Outro Clip Upload Bar */}
      <div className="grid grid-cols-2 gap-3">
        {/* Intro Clip Box */}
        <div className="p-3 rounded-xl bg-[#0a0a0c] border border-white/5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Film className="w-3.5 h-3.5 text-indigo-400" /> Intro Video Clip
            </span>
            <input
              type="checkbox"
              checked={introOutro.enableIntro}
              onChange={e => onUpdateIntroOutro({ ...introOutro, enableIntro: e.target.checked })}
              className="w-3.5 h-3.5 accent-indigo-600 rounded cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="flex-1 cursor-pointer py-1.5 px-2.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-[11px] font-bold flex items-center justify-center gap-1.5 transition">
              <Upload className="w-3 h-3" /> {introOutro.introVideoUrl ? 'Change Intro Video' : 'Import Intro MP4'}
              <input
                type="file"
                accept="video/*,image/*"
                onChange={e => handleFileUpload(e, 'intro')}
                className="hidden"
              />
            </label>

            {introOutro.introVideoUrl && (
              <button
                type="button"
                onClick={() => onUpdateIntroOutro({ ...introOutro, introVideoUrl: null })}
                className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 text-[11px]"
                title="Remove Intro Video"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Outro Clip Box */}
        <div className="p-3 rounded-xl bg-[#0a0a0c] border border-white/5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Film className="w-3.5 h-3.5 text-purple-400" /> Outro Video Clip
            </span>
            <input
              type="checkbox"
              checked={introOutro.enableOutro}
              onChange={e => onUpdateIntroOutro({ ...introOutro, enableOutro: e.target.checked })}
              className="w-3.5 h-3.5 accent-purple-600 rounded cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="flex-1 cursor-pointer py-1.5 px-2.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-[11px] font-bold flex items-center justify-center gap-1.5 transition">
              <Upload className="w-3 h-3" /> {introOutro.outroVideoUrl ? 'Change Outro Video' : 'Import Outro MP4'}
              <input
                type="file"
                accept="video/*,image/*"
                onChange={e => handleFileUpload(e, 'outro')}
                className="hidden"
              />
            </label>

            {introOutro.outroVideoUrl && (
              <button
                type="button"
                onClick={() => onUpdateIntroOutro({ ...introOutro, outroVideoUrl: null })}
                className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 text-[11px]"
                title="Remove Outro Video"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Multi-Track Timeline Canvas Area */}
      <div
        ref={timelineRef}
        onClick={handleTimelineClick}
        className="relative bg-[#0a0a0c] border border-white/10 rounded-xl p-3 space-y-2 cursor-pointer select-none overflow-hidden"
      >
        {/* Scrub Playhead Line */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-30 transition-all duration-150 pointer-events-none"
          style={{ left: `${playheadPercent}%` }}
        >
          <div className="w-3 h-3 bg-red-500 rounded-full -ml-1.25 -mt-1 shadow-lg shadow-red-500/50" />
        </div>

        {/* TRACK 1: Video & Question Blocks */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[9px] font-bold text-white/40 uppercase tracking-wider">
            <span className="flex items-center gap-1"><Video className="w-3 h-3 text-indigo-400" /> Video & Clips Track</span>
            <span>{questions.length} Questions</span>
          </div>

          <div className="flex h-8 gap-1 rounded-lg overflow-hidden bg-black/40 p-1 border border-white/5">
            {/* Intro Block */}
            {introOutro.enableIntro && (
              <div
                className="bg-indigo-900/60 border border-indigo-500/40 rounded px-2 text-[10px] font-bold text-indigo-200 flex items-center justify-center shrink-0 min-w-[50px]"
                style={{ flex: introDur }}
              >
                INTRO
              </div>
            )}

            {/* Question Blocks */}
            {questions.map((q, idx) => {
              const isSelected = idx === currentIndex;
              return (
                <div
                  key={q.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectQuestion(idx);
                  }}
                  className={`flex-1 rounded px-2 text-[10px] font-black tracking-wider flex items-center justify-between transition border ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/30'
                      : 'bg-indigo-950/40 text-white/60 border-indigo-500/20 hover:bg-indigo-900/30 hover:text-white'
                  }`}
                >
                  <span className="truncate">Q{idx + 1}</span>
                  <span className="text-[9px] font-mono opacity-60 ml-1">{perQuestionDuration}s</span>
                </div>
              );
            })}

            {/* Outro Block */}
            {introOutro.enableOutro && (
              <div
                className="bg-purple-900/60 border border-purple-500/40 rounded px-2 text-[10px] font-bold text-purple-200 flex items-center justify-center shrink-0 min-w-[50px]"
                style={{ flex: outroDur }}
              >
                OUTRO
              </div>
            )}
          </div>
        </div>

        {/* TRACK 2: Voiceover / Narration Track */}
        <div className="space-y-1">
          <div className="text-[9px] font-bold text-white/40 uppercase tracking-wider flex items-center gap-1">
            <Mic className="w-3 h-3 text-emerald-400" /> TTS Voice Narration Track
          </div>
          <div className="flex h-5 gap-1 rounded bg-black/40 p-0.5 border border-white/5 items-center">
            {questions.map((q, idx) => (
              <div
                key={`tts-${q.id}`}
                className="flex-1 h-full bg-emerald-500/20 border border-emerald-500/30 rounded flex items-center justify-center text-[8px] font-mono font-bold text-emerald-300"
              >
                Speech
              </div>
            ))}
          </div>
        </div>

        {/* TRACK 3: Background Music & Audio Ducking Track */}
        <div className="space-y-1">
          <div className="text-[9px] font-bold text-white/40 uppercase tracking-wider flex items-center gap-1">
            <Music className="w-3 h-3 text-purple-400" /> Background Music & Auto-Ducking Track
          </div>
          <div className="flex h-5 rounded bg-black/40 p-0.5 border border-white/5 items-center">
            <div className="w-full h-full bg-purple-600/20 border border-purple-500/30 rounded flex items-center justify-between px-2 text-[8px] font-mono font-bold text-purple-300">
              <span>♪ BG Music</span>
              {audioConfig.enableDucking !== false && (
                <span className="text-emerald-400 text-[8px]">Auto-Ducking Enabled</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

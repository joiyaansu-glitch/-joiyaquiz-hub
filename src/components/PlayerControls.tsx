import React from 'react';
import { Play, Pause, SkipBack, SkipForward, Timer, Eye, Repeat, Sparkles } from 'lucide-react';
import { QuizPlaybackState } from '../types';

interface PlayerControlsProps {
  playbackState: QuizPlaybackState;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onStartCountdown: () => void;
  onRevealAnswer: () => void;
  currentIndex: number;
  totalQuestions: number;
  timerSeconds: number;
  autoLoop: boolean;
  onToggleAutoLoop: () => void;
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({
  playbackState,
  onTogglePlay,
  onPrev,
  onNext,
  onStartCountdown,
  onRevealAnswer,
  currentIndex,
  totalQuestions,
  timerSeconds,
  autoLoop,
  onToggleAutoLoop,
}) => {
  const isPlaying =
    playbackState === 'intro' ||
    playbackState === 'reading' ||
    playbackState === 'countdown' ||
    playbackState === 'reveal' ||
    playbackState === 'transitioning' ||
    playbackState === 'outro';

  return (
    <div className="bg-[#121217] border border-white/5 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-2xl text-white">
      {/* Question Counter & State Badge */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/40 border border-white/5 text-xs font-black tracking-widest uppercase">
          <span className="text-indigo-400">
            {playbackState === 'intro' ? 'INTRO' : playbackState === 'outro' ? 'OUTRO' : `Q${currentIndex + 1}`}
          </span>
          {playbackState !== 'intro' && playbackState !== 'outro' && (
            <>
              <span className="text-white/20">/</span>
              <span className="text-white/60">{totalQuestions}</span>
            </>
          )}
        </div>

        <div className="px-3 py-1.5 rounded-xl bg-black/40 border border-white/5 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              playbackState === 'intro'
                ? 'bg-blue-400 animate-pulse'
                : playbackState === 'reading'
                ? 'bg-indigo-400 animate-pulse'
                : playbackState === 'countdown'
                ? 'bg-amber-400 animate-ping'
                : playbackState === 'reveal'
                ? 'bg-emerald-400 shadow-sm'
                : playbackState === 'transitioning'
                ? 'bg-purple-400 animate-pulse'
                : playbackState === 'outro'
                ? 'bg-fuchsia-400 animate-pulse'
                : 'bg-white/30'
            }`}
          />
          <span className="text-white/70">
            {playbackState === 'intro'
              ? 'Playing Intro Clip'
              : playbackState === 'reading'
              ? 'Voice Reading'
              : playbackState === 'countdown'
              ? `Timer: ${timerSeconds}s`
              : playbackState === 'reveal'
              ? 'Answer Revealed'
              : playbackState === 'transitioning'
              ? 'Next Question...'
              : playbackState === 'outro'
              ? 'Playing Outro Clip'
              : 'Idle'}
          </span>
        </div>
      </div>

      {/* Main Transport Control Buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={onPrev}
          disabled={currentIndex === 0}
          className="p-2.5 rounded-xl bg-black/40 hover:bg-white/10 text-white disabled:opacity-30 transition border border-white/5"
          title="Previous Question"
        >
          <SkipBack className="w-4 h-4" />
        </button>

        <button
          onClick={onTogglePlay}
          className={`px-5 py-2.5 rounded-full font-black text-xs uppercase tracking-widest flex items-center gap-2 transition shadow-lg active:scale-95 ${
            isPlaying
              ? 'bg-amber-500 text-black shadow-amber-500/20 hover:bg-amber-400'
              : 'bg-indigo-600 text-white shadow-indigo-600/30 hover:bg-indigo-700'
          }`}
          title="Auto Play All Questions in Sequence"
        >
          {isPlaying ? (
            <>
              <Pause className="w-4 h-4 fill-current" /> Pause Playback
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" /> Auto Play Quiz
            </>
          )}
        </button>

        <button
          onClick={onNext}
          disabled={currentIndex >= totalQuestions - 1}
          className="p-2.5 rounded-xl bg-black/40 hover:bg-white/10 text-white disabled:opacity-30 transition border border-white/5"
          title="Next Question"
        >
          <SkipForward className="w-4 h-4" />
        </button>
      </div>

      {/* Manual Actions & Auto Loop */}
      <div className="flex items-center gap-2">
        <button
          onClick={onStartCountdown}
          className="px-3 py-2 rounded-xl bg-black/40 hover:bg-white/10 text-emerald-400 text-[10px] font-black uppercase tracking-wider transition border border-white/5 flex items-center gap-1.5"
        >
          <Timer className="w-3.5 h-3.5" /> Timer
        </button>

        <button
          onClick={onRevealAnswer}
          className="px-3 py-2 rounded-xl bg-black/40 hover:bg-white/10 text-indigo-300 text-[10px] font-black uppercase tracking-wider transition border border-white/5 flex items-center gap-1.5"
        >
          <Eye className="w-3.5 h-3.5" /> Reveal
        </button>

        <button
          onClick={onToggleAutoLoop}
          className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition border flex items-center gap-1.5 ${
            autoLoop
              ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/40'
              : 'bg-black/40 text-white/40 border-white/5 hover:text-white'
          }`}
          title="Auto Loop Quiz Sequence"
        >
          <Repeat className="w-3.5 h-3.5" /> Loop
        </button>
      </div>
    </div>
  );
};

import React, { useState, useRef } from 'react';
import { Download, Film, Loader2, CheckCircle2, X, HardDriveDownload, Sparkles, Monitor, Mic, StopCircle, ListOrdered } from 'lucide-react';
import { QuizItem, QuizThemeConfig, AudioConfig, IntroOutroConfig } from '../types';
import { speakText, cancelSpeech, findVoicePersonaById, ALL_VOICE_LANGUAGES, preloadTtsBatch } from '../utils/ttsEngine';
import {
  playCountdownBeep,
  playVictoryFanfare,
  stopTimerAudio,
  getAudioContext,
  getAudioDestinationStream,
  preloadCustomAudio,
  startBackgroundMusic,
  stopBackgroundMusic,
  duckBackgroundMusic,
  playIntroMediaAudio,
  playOutroMediaAudio,
  stopIntroOutroAudio
} from '../utils/audioEngine';

interface VideoExporterModalProps {
  isOpen: boolean;
  onClose: () => void;
  questions: QuizItem[];
  theme: QuizThemeConfig;
  audioConfig: AudioConfig;
  introOutro?: IntroOutroConfig;
  getCanvasElement: () => HTMLCanvasElement | null;
  setCurrentQuestionIndex?: (idx: number) => void;
  setPlaybackState?: (state: any) => void;
  setTimerSeconds?: (sec: number) => void;
}

export type ExportResolution = '720p' | '1080p' | '4K';

export const VideoExporterModal: React.FC<VideoExporterModalProps> = ({
  isOpen,
  onClose,
  questions,
  theme,
  audioConfig,
  introOutro,
  getCanvasElement,
  setCurrentQuestionIndex,
  setPlaybackState,
  setTimerSeconds,
}) => {
  const [resolution, setResolution] = useState<ExportResolution>('1080p');
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStepText, setCurrentStepText] = useState('Initializing rendering engine...');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Range options (e.g. All 40 questions or custom 1 to 40)
  const [exportRangeMode, setExportRangeMode] = useState<'all' | 'custom'>('all');
  const [rangeStart, setRangeStart] = useState(1);
  const [rangeEnd, setRangeEnd] = useState(questions.length || 1);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const isAbortedRef = useRef<boolean>(false);

  if (!isOpen) return null;

  const handleCancelExport = () => {
    isAbortedRef.current = true;
    cancelSpeech();
    stopTimerAudio();
    stopBackgroundMusic();
    stopIntroOutroAudio();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }
    setIsExporting(false);
    setProgress(0);
    setCurrentStepText('Export cancelled.');
  };

  const startVideoExport = async () => {
    setExportError(null);
    isAbortedRef.current = false;
    const canvas = getCanvasElement();
    if (!canvas || questions.length === 0) {
      setExportError('Canvas or questions not ready. Please make sure at least one question exists.');
      return;
    }

    // Determine target subset of questions
    const startIdx = exportRangeMode === 'custom' ? Math.max(0, rangeStart - 1) : 0;
    const endIdx = exportRangeMode === 'custom' ? Math.min(questions.length, Math.max(startIdx + 1, rangeEnd)) : questions.length;
    const targetQuestions = questions.slice(startIdx, endIdx);

    if (targetQuestions.length === 0) {
      setExportError('No questions selected for export.');
      return;
    }

    setIsExporting(true);
    setProgress(0);
    setIsDone(false);
    setVideoUrl(null);
    recordedChunksRef.current = [];

    // Preload custom audio files if present
    if (audioConfig.customTimerSoundUrl) {
      await preloadCustomAudio(audioConfig.customTimerSoundUrl);
    }
    if (audioConfig.customAnswerSoundUrl) {
      await preloadCustomAudio(audioConfig.customAnswerSoundUrl);
    }

    // Preload ALL narration audio (question + answer-reveal lines) for every question
    // in this export BEFORE recording starts. Without this, each line was fetched live
    // from the TTS server one at a time during recording, which caused a noticeable
    // pause/stutter between narration lines on longer quizzes (e.g. 30+ questions).
    if (audioConfig.enableTTS && !isAbortedRef.current) {
      const narrationLines: string[] = [];
      for (const item of targetQuestions) {
        narrationLines.push(item.question);
        const correctLetter = item.answer || 'A';
        const letterIdx = ['A', 'B', 'C', 'D'].indexOf(correctLetter);
        const correctOptionText = item.options[letterIdx] || '';
        const reveal = item.explanation
          ? `The correct answer is Option ${correctLetter}: ${correctOptionText}. ${item.explanation}`
          : `The correct answer is Option ${correctLetter}: ${correctOptionText}.`;
        narrationLines.push(reveal);
      }

      setCurrentStepText(`Preparing narration audio... 0/${narrationLines.length}`);
      setProgress(1);

      await preloadTtsBatch(
        narrationLines,
        {
          language: audioConfig.language,
          gender: audioConfig.voiceGender,
          voicePersonaId: audioConfig.voicePersonaId,
          rate: Math.max(1.1, audioConfig.speechRate),
          volume: audioConfig.volume,
        },
        (done, total) => {
          if (isAbortedRef.current) return;
          setCurrentStepText(`Preparing narration audio... ${done}/${total}`);
          setProgress(Math.round((done / Math.max(1, total)) * 8));
        }
      );
    }

    if (isAbortedRef.current) {
      return;
    }

    const origWidth = canvas.width;
    const origHeight = canvas.height;

    // Set resolution targets
    let targetW = 1920;
    let targetH = 1080;
    let videoBitrate = 12000000; // 12 Mbps for 1080p

    if (resolution === '720p') {
      targetW = 1280;
      targetH = 720;
      videoBitrate = 6000000;
    } else if (resolution === '4K') {
      targetW = 3840;
      targetH = 2160;
      videoBitrate = 28000000; // 28 Mbps for 4K
    }

    // Scale canvas to export target resolution
    canvas.width = targetW;
    canvas.height = targetH;

    try {
      // Ensure AudioContext is active
      const audioCtx = getAudioContext();
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      // Create canvas video stream at 60 FPS
      const canvasStream = canvas.captureStream(60);

      // Get audio destination stream from Web Audio API synthesizer
      const audioDestination = getAudioDestinationStream();
      const audioTracks = audioDestination.stream.getAudioTracks();

      const combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...audioTracks,
      ]);

      // Determine best supported recorder format with explicit audio bitrates
      const mimeTypesToTry = [
        'video/mp4;codecs=avc1,mp4a.40.2',
        'video/mp4;codecs=h264,aac',
        'video/mp4;codecs=h264',
        'video/mp4',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm'
      ];

      let selectedMimeType = '';
      for (const type of mimeTypesToTry) {
        if (MediaRecorder.isTypeSupported(type)) {
          selectedMimeType = type;
          break;
        }
      }

      const recorderOptions: MediaRecorderOptions = {
        videoBitsPerSecond: videoBitrate,
        audioBitsPerSecond: 192000,
      };
      if (selectedMimeType) {
        recorderOptions.mimeType = selectedMimeType;
      }

      const mediaRecorder = new MediaRecorder(combinedStream, recorderOptions);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (isAbortedRef.current) return;
        const finalBlob = new Blob(recordedChunksRef.current, {
          type: selectedMimeType || 'video/mp4',
        });
        const url = URL.createObjectURL(finalBlob);
        setVideoUrl(url);
        setIsExporting(false);
        setIsDone(true);
        setProgress(100);

        // Restore canvas size
        canvas.width = origWidth;
        canvas.height = origHeight;

        // Cleanup audio
        stopTimerAudio();
        stopBackgroundMusic();
        stopIntroOutroAudio();
        cancelSpeech();
        if (setPlaybackState) setPlaybackState('idle');
      };

      mediaRecorder.start(100);

      // 0. Render Intro Clip if enabled (Background music remains OFF during Intro)
      if (introOutro?.enableIntro && !isAbortedRef.current) {
        setCurrentStepText('Playing Intro clip with audio in video...');
        setProgress(2);
        if (setPlaybackState) setPlaybackState('intro');
        if (setCurrentQuestionIndex) setCurrentQuestionIndex(startIdx);

        if (introOutro?.introVideoUrl) {
          await playIntroMediaAudio(introOutro.introVideoUrl, audioConfig.volume ?? 0.8);
        }

        const introDurationSec = Math.max(1, introOutro.introDuration || 3);
        const introMs = introDurationSec * 1000;
        const startIntroTime = Date.now();
        while (Date.now() - startIntroTime < introMs && !isAbortedRef.current) {
          await new Promise(r => setTimeout(r, 100));
        }
        stopIntroOutroAudio();

        if (isAbortedRef.current) return;

        // Brief transition from intro to first question
        if (setPlaybackState) setPlaybackState('transitioning');
        await new Promise(r => setTimeout(r, 500));
      }

      // Start Background Music AFTER Intro (for the question rounds)
      if (audioConfig.enableBgMusic !== false && !isAbortedRef.current) {
        startBackgroundMusic(
          audioConfig.bgMusicUrl,
          audioConfig.bgMusicVolume ?? 0.18,
          audioConfig.volume ?? 0.8
        );
      }

      // Sequentially render all questions in target set
      const totalQuestions = targetQuestions.length;

      for (let i = 0; i < totalQuestions; i++) {
        if (isAbortedRef.current) break;

        const globalIdx = startIdx + i;
        const item = targetQuestions[i];
        const stepBase = (i / totalQuestions) * 90;

        // Update canvas state for Question i
        if (setCurrentQuestionIndex) setCurrentQuestionIndex(globalIdx);
        if (setPlaybackState) setPlaybackState('reading');
        if (setTimerSeconds) setTimerSeconds(theme.timerDuration || 10);

        // 1. Voice Reading
        setCurrentStepText(`Question ${i + 1}/${totalQuestions} (#${globalIdx + 1}): Reading question...`);
        setProgress(Math.round(stepBase + 5));

        if (audioConfig.enableTTS) {
          if (audioConfig.enableDucking !== false) {
            duckBackgroundMusic(true, audioConfig.bgMusicVolume ?? 0.18);
          }
          const narrationText = `${item.question}`;
          await new Promise<void>((resolve) => {
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
                  duckBackgroundMusic(false, audioConfig.bgMusicVolume ?? 0.18);
                }
                resolve();
              }
            );
          });
        } else {
          await new Promise(r => setTimeout(r, 2000));
        }

        if (isAbortedRef.current) break;

        // 2. Countdown Timer
        setCurrentStepText(`Question ${i + 1}/${totalQuestions} (#${globalIdx + 1}): Countdown timer...`);
        const duration = theme.timerDuration || 10;
        if (setPlaybackState) setPlaybackState('countdown');
        if (setTimerSeconds) setTimerSeconds(duration);
        stopTimerAudio();

        if (audioConfig.enableBeepSound && audioConfig.customTimerSoundUrl) {
          playCountdownBeep(
            audioConfig.volume,
            false,
            audioConfig.customTimerSoundUrl,
            true, // isFirstTick
            audioConfig.timerVolume ?? 0.7
          );
        }

        for (let sec = duration - 1; sec >= 0; sec--) {
          if (isAbortedRef.current) break;
          await new Promise(r => setTimeout(r, 1000));
          if (setTimerSeconds) setTimerSeconds(sec);
          setProgress(Math.round(stepBase + 15 + ((duration - sec) / duration) * 35));
          if (audioConfig.enableBeepSound && !audioConfig.customTimerSoundUrl) {
            playCountdownBeep(
              audioConfig.volume,
              sec <= 1,
              null,
              false,
              audioConfig.timerVolume ?? 0.7
            );
          }
        }
        if (setTimerSeconds) setTimerSeconds(0);
        stopTimerAudio();

        if (isAbortedRef.current) break;

        // 3. Answer Reveal & Voice Over
        setCurrentStepText(`Question ${i + 1}/${totalQuestions} (#${globalIdx + 1}): Revealing answer ${item.answer}...`);
        setProgress(Math.round(stepBase + 55));
        if (setPlaybackState) setPlaybackState('reveal');

        if (audioConfig.enableFanfareSound) {
          playVictoryFanfare(
            audioConfig.volume,
            audioConfig.customAnswerSoundUrl,
            audioConfig.answerVolume ?? 0.8
          );
        }

        if (audioConfig.enableTTS) {
          if (audioConfig.enableDucking !== false) {
            duckBackgroundMusic(true, audioConfig.bgMusicVolume ?? 0.18);
          }
          const correctLetter = item.answer || 'A';
          const letterIdx = ['A', 'B', 'C', 'D'].indexOf(correctLetter);
          const correctOptionText = item.options[letterIdx] || '';
          const answerTTS = item.explanation
            ? `The correct answer is Option ${correctLetter}: ${correctOptionText}. ${item.explanation}`
            : `The correct answer is Option ${correctLetter}: ${correctOptionText}.`;

          await new Promise<void>((resolve) => {
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
                  duckBackgroundMusic(false, audioConfig.bgMusicVolume ?? 0.18);
                }
                resolve();
              }
            );
          });
        } else {
          await new Promise(r => setTimeout(r, theme.revealDelay * 1000));
        }

        if (isAbortedRef.current) break;

        // 4. 1-Second Transition to Next Question
        if (i < totalQuestions - 1) {
          if (setPlaybackState) setPlaybackState('transitioning');
          if (setCurrentQuestionIndex) setCurrentQuestionIndex(globalIdx + 1);
          await new Promise(r => setTimeout(r, 1000));
        }
      }

      if (isAbortedRef.current) {
        canvas.width = origWidth;
        canvas.height = origHeight;
        return;
      }

      // Outro Clip if enabled
      if (introOutro?.enableOutro && !isAbortedRef.current) {
        stopBackgroundMusic(); // Stop background music so outro sound plays clearly
        setCurrentStepText('Playing Outro clip with audio in video...');
        setProgress(96);
        if (setPlaybackState) setPlaybackState('outro');

        if (introOutro?.outroVideoUrl) {
          await playOutroMediaAudio(introOutro.outroVideoUrl, audioConfig.volume ?? 0.8);
        }

        const outroDurationSec = Math.max(1, introOutro.outroDuration || 3);
        const outroMs = outroDurationSec * 1000;
        const startOutroTime = Date.now();
        while (Date.now() - startOutroTime < outroMs && !isAbortedRef.current) {
          await new Promise(r => setTimeout(r, 100));
        }
        stopIntroOutroAudio();
      }

      if (isAbortedRef.current) {
        canvas.width = origWidth;
        canvas.height = origHeight;
        return;
      }

      // Stop Recording
      setCurrentStepText(`Finalizing ${resolution} MP4 video...`);
      mediaRecorder.stop();
    } catch (err: any) {
      console.error('Video Export Error:', err);
      setExportError('Video export failed: ' + (err?.message || 'Unknown error occurred.'));
      setIsExporting(false);
      canvas.width = origWidth;
      canvas.height = origHeight;
    }
  };

  const handleDownloadJsonPackage = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify({
      questions,
      theme,
      audioConfig,
      exportedAt: new Date().toISOString()
    }, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `quiz_package_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const activeExportCount = exportRangeMode === 'custom'
    ? Math.max(1, Math.min(questions.length, rangeEnd) - Math.max(1, rangeStart) + 1)
    : questions.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-[#121217] border border-white/10 text-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#0a0a0c] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black uppercase tracking-wider">MP4 Video Exporter</h2>
              <p className="text-[11px] text-white/50">Render full quiz video with narration & sounds</p>
            </div>
          </div>
          <button
            onClick={() => {
              if (isExporting) handleCancelExport();
              cancelSpeech();
              onClose();
            }}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {exportError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-bold leading-relaxed">
              {exportError}
            </div>
          )}

          {!isExporting && !isDone && (
            <div className="text-center py-2 space-y-5">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-600/10">
                <Sparkles className="w-7 h-7" />
              </div>

              <div>
                <h3 className="text-base font-black uppercase tracking-wider text-white">Ready to Render Video</h3>
                <p className="text-xs text-white/50 mt-1 max-w-sm mx-auto">
                  Exporting <span className="text-indigo-400 font-bold">{activeExportCount} of {questions.length} questions</span> into a continuous video.
                </p>
              </div>

              {/* Questions Scope Selector */}
              <div className="p-3.5 rounded-xl bg-[#0a0a0c] border border-white/5 space-y-2 text-left">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                    <ListOrdered className="w-3.5 h-3.5" /> Questions to Include
                  </label>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    {activeExportCount} Questions Selected
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setExportRangeMode('all')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 border ${
                      exportRangeMode === 'all'
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                        : 'bg-[#121217] text-white/40 border-white/5 hover:text-white'
                    }`}
                  >
                    All Questions ({questions.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setExportRangeMode('custom');
                      setRangeStart(1);
                      setRangeEnd(questions.length);
                    }}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 border ${
                      exportRangeMode === 'custom'
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                        : 'bg-[#121217] text-white/40 border-white/5 hover:text-white'
                    }`}
                  >
                    Custom Range
                  </button>
                </div>

                {exportRangeMode === 'custom' && (
                  <div className="flex items-center gap-2 pt-2 text-xs">
                    <span className="text-white/40 text-[11px]">From Q#</span>
                    <input
                      type="number"
                      min={1}
                      max={questions.length}
                      value={rangeStart}
                      onChange={e => setRangeStart(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-16 px-2 py-1 rounded bg-[#121217] border border-white/10 text-white font-mono text-center outline-none focus:border-indigo-500"
                    />
                    <span className="text-white/40 text-[11px]">to Q#</span>
                    <input
                      type="number"
                      min={rangeStart}
                      max={questions.length}
                      value={rangeEnd}
                      onChange={e => setRangeEnd(Math.max(rangeStart, Math.min(questions.length, parseInt(e.target.value) || questions.length)))}
                      className="w-16 px-2 py-1 rounded bg-[#121217] border border-white/10 text-white font-mono text-center outline-none focus:border-indigo-500"
                    />
                  </div>
                )}
              </div>

              {/* Voice Narrator Info Card */}
              {(() => {
                const persona = findVoicePersonaById(audioConfig.voicePersonaId);
                const langInfo = ALL_VOICE_LANGUAGES.find(l => l.id === audioConfig.language);
                return (
                  <div className="p-3 rounded-xl bg-[#0a0a0c] border border-white/5 flex items-center justify-between text-left">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl border ${
                        audioConfig.voiceGender === 'female'
                          ? 'bg-pink-600/20 text-pink-400 border-pink-500/30'
                          : 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30'
                      }`}>
                        <Mic className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">
                            {langInfo?.flag || '🌐'} {langInfo?.label || audioConfig.language}
                          </span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold uppercase ${
                            audioConfig.voiceGender === 'female'
                              ? 'bg-pink-500/20 text-pink-300'
                              : 'bg-indigo-500/20 text-indigo-300'
                          }`}>
                            {audioConfig.voiceGender === 'female' ? '👩 Female Host' : '👨 Male Host'}
                          </span>
                        </div>
                        <p className="text-[10px] text-white/40 mt-0.5">
                          Narrator: {persona?.name || (audioConfig.voiceGender === 'female' ? 'Female Voice' : 'Male Voice')}
                        </p>
                      </div>
                    </div>

                    <span className="text-[10px] font-mono text-emerald-400 font-bold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                      {audioConfig.enableTTS ? 'TTS ON' : 'TTS OFF'}
                    </span>
                  </div>
                );
              })()}

              {/* Resolution Selector */}
              <div className="p-3.5 rounded-xl bg-[#0a0a0c] border border-white/5 space-y-2 text-left">
                <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Monitor className="w-3.5 h-3.5" /> Video Output Resolution
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['720p', '1080p', '4K'] as ExportResolution[]).map((res) => (
                    <button
                      key={res}
                      type="button"
                      onClick={() => setResolution(res)}
                      className={`py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider border transition flex flex-col items-center justify-center gap-0.5 ${
                        resolution === res
                          ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/30'
                          : 'bg-[#121217] text-white/40 border-white/5 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <span>{res}</span>
                      <span className="text-[9px] font-mono opacity-60">
                        {res === '720p' ? '1280x720' : res === '1080p' ? '1920x1080' : '3840x2160'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={startVideoExport}
                  className="px-8 py-3.5 rounded-full bg-indigo-600 text-white font-black text-xs hover:bg-indigo-700 transition flex items-center justify-center gap-2 mx-auto shadow-xl shadow-indigo-600/30 uppercase tracking-widest active:scale-95 w-full"
                >
                  <Film className="w-4 h-4" /> Start Export ({activeExportCount} Questions • {resolution})
                </button>
              </div>
            </div>
          )}

          {/* Progress Indicator */}
          {isExporting && (
            <div className="py-8 space-y-5 text-center">
              <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                <Loader2 className="w-16 h-16 text-indigo-500 animate-spin" />
                <span className="absolute font-mono text-xs font-black text-white">
                  {progress}%
                </span>
              </div>

              <div>
                <h3 className="text-sm font-bold text-white/90 uppercase tracking-wider">{currentStepText}</h3>
                <p className="text-xs text-white/40 mt-1">Rendering in {resolution} resolution. Please do not close this window...</p>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-3 rounded-full bg-[#0a0a0c] border border-white/10 overflow-hidden">
                <div
                  className="h-full bg-indigo-600 transition-all duration-300 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>

              {/* Cancel Button */}
              <button
                type="button"
                onClick={handleCancelExport}
                className="mt-3 px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 mx-auto border border-rose-500/30 transition"
              >
                <StopCircle className="w-4 h-4" /> Cancel Export
              </button>
            </div>
          )}

          {/* Export Completed Screen */}
          {isDone && videoUrl && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between font-bold">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <p className="uppercase tracking-wider">Quiz Video Rendered Successfully!</p>
                    <p className="text-[10px] text-emerald-400/80 font-normal">All {activeExportCount} questions captured with voice narration, timer, & background music.</p>
                  </div>
                </div>
                <span className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px] border border-emerald-500/30">{resolution}</span>
              </div>

              {/* Video Preview Player */}
              <div className="w-full aspect-video rounded-xl overflow-hidden bg-black border border-white/10 shadow-2xl relative">
                <video src={videoUrl} controls autoPlay className="w-full h-full object-contain" />
              </div>

              {/* Download Buttons */}
              <div className="space-y-2 pt-1">
                <a
                  href={videoUrl}
                  download={`quiz_video_${resolution}_${Date.now()}.mp4`}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-black text-xs transition flex items-center justify-center gap-2 shadow-xl shadow-emerald-600/20 uppercase tracking-widest active:scale-95 border border-emerald-400/30"
                >
                  <Download className="w-4 h-4" /> 1-Click Download {resolution} Video
                </a>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => {
                      setIsDone(false);
                      setVideoUrl(null);
                    }}
                    className="py-2.5 px-3 rounded-xl bg-[#1a1a22] hover:bg-white/10 text-white/70 hover:text-white font-bold text-[11px] transition flex items-center justify-center gap-1.5 border border-white/5 uppercase tracking-wider active:scale-95"
                  >
                    <Film className="w-3.5 h-3.5 text-indigo-400" /> Export Other Resolution
                  </button>

                  <button
                    onClick={handleDownloadJsonPackage}
                    className="py-2.5 px-3 rounded-xl bg-[#1a1a22] hover:bg-white/10 text-white/70 hover:text-white font-bold text-[11px] transition flex items-center justify-center gap-1.5 border border-white/5 uppercase tracking-wider active:scale-95"
                  >
                    <HardDriveDownload className="w-3.5 h-3.5 text-indigo-400" /> Save Quiz (.JSON)
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

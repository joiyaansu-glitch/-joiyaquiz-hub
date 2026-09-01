import React, { useState, useEffect } from 'react';
import {
  Volume2,
  Mic,
  Globe,
  Music,
  Upload,
  Play,
  Square,
  Trash2,
  FolderHeart,
} from 'lucide-react';
import {
  AudioConfig,
  VoiceLanguage,
  VoiceGender,
  StoredAudioTrack,
  VoicePersona,
} from '../types';
import { preloadCustomAudio, playCountdownBeep, playVictoryFanfare } from '../utils/audioEngine';
import {
  ALL_VOICE_LANGUAGES,
  VOICE_PERSONAS,
  getVoicePersonas,
  findVoicePersonaById,
  playVoicePreview,
  cancelSpeech,
} from '../utils/ttsEngine';
import { saveAudioToLibrary, getStoredAudioTracks, deleteAudioTrackFromLibrary } from '../utils/audioStorage';

interface AudioCustomizerProps {
  config: AudioConfig;
  onChange: (config: AudioConfig) => void;
}

export const AudioCustomizer: React.FC<AudioCustomizerProps> = ({ config, onChange }) => {
  const [libraryTracks, setLibraryTracks] = useState<StoredAudioTrack[]>([]);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [playingPersonaId, setPlayingPersonaId] = useState<string | null>(null);
  const [previewCancelFn, setPreviewCancelFn] = useState<(() => void) | null>(null);

  // Load stored audio library on mount
  useEffect(() => {
    loadLibrary();
    return () => {
      cancelSpeech();
    };
  }, []);

  const loadLibrary = async () => {
    const tracks = await getStoredAudioTracks();
    setLibraryTracks(tracks);
  };

  const updateProp = <K extends keyof AudioConfig>(key: K, value: AudioConfig[K]) => {
    onChange({ ...config, [key]: value });
  };

  // Get available personas for the current language & gender (minimum 5 male + 5 female per language)
  const availablePersonas = getVoicePersonas(config.language, config.voiceGender);
  const selectedPersona =
    findVoicePersonaById(config.voicePersonaId) || availablePersonas[0] || VOICE_PERSONAS[0];

  // Language Change handler: pick first appropriate persona
  const handleLanguageChange = (newLang: VoiceLanguage) => {
    if (previewCancelFn) previewCancelFn();
    cancelSpeech();
    setPlayingPersonaId(null);

    const matching = getVoicePersonas(newLang, config.voiceGender);
    const newPersona = matching[0] || VOICE_PERSONAS.find((p) => p.language === newLang);
    onChange({
      ...config,
      language: newLang,
      voicePersonaId: newPersona ? newPersona.id : undefined,
    });
  };

  // Gender Change handler: pick first appropriate persona
  const handleGenderChange = (newGender: VoiceGender) => {
    if (previewCancelFn) previewCancelFn();
    cancelSpeech();
    setPlayingPersonaId(null);

    const matching = getVoicePersonas(config.language, newGender);
    const newPersona = matching[0] || VOICE_PERSONAS.find((p) => p.gender === newGender);
    onChange({
      ...config,
      voiceGender: newGender,
      voicePersonaId: newPersona ? newPersona.id : undefined,
    });
  };

  // Persona Selection & Inline Play/Pause handler
  const handleSelectAndPlayPersona = (persona: VoicePersona, e?: React.MouseEvent) => {
    e?.stopPropagation();

    // If already playing this persona, stop it
    if (playingPersonaId === persona.id) {
      if (previewCancelFn) previewCancelFn();
      cancelSpeech();
      setPlayingPersonaId(null);
      setPreviewCancelFn(null);
      return;
    }

    // Stop existing preview
    if (previewCancelFn) previewCancelFn();
    cancelSpeech();

    // Select the persona
    onChange({
      ...config,
      voicePersonaId: persona.id,
      voiceGender: persona.gender,
      language: persona.language,
    });

    // Start playing preview audio
    setPlayingPersonaId(persona.id);
    const cancel = playVoicePreview(
      persona,
      {
        rate: config.speechRate,
        volume: config.volume,
      },
      () => {
        setPlayingPersonaId(null);
        setPreviewCancelFn(null);
      }
    );
    setPreviewCancelFn(() => cancel);
  };

  // Upload Background Music & Save to History
  const handleBgMusicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      await preloadCustomAudio(dataUrl);
      onChange({ ...config, bgMusicUrl: dataUrl, enableBgMusic: true });

      // Save to IndexedDB Library History
      await saveAudioToLibrary(file.name, dataUrl, 'bgMusic');
      await loadLibrary();
    };
    reader.readAsDataURL(file);
  };

  // Upload Custom Timer / Answer Sound & Save to History
  const handleCustomAudioUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'timer' | 'answer'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      await preloadCustomAudio(dataUrl);
      if (type === 'timer') {
        onChange({ ...config, customTimerSoundUrl: dataUrl });
      } else {
        onChange({ ...config, customAnswerSoundUrl: dataUrl });
      }

      // Save to IndexedDB Library History
      await saveAudioToLibrary(file.name, dataUrl, type);
      await loadLibrary();
    };
    reader.readAsDataURL(file);
  };

  const clearCustomSound = (type: 'timer' | 'answer') => {
    if (type === 'timer') {
      onChange({ ...config, customTimerSoundUrl: null });
    } else {
      onChange({ ...config, customAnswerSoundUrl: null });
    }
  };

  const testSound = (type: 'timer' | 'answer') => {
    if (type === 'timer') {
      playCountdownBeep(
        config.volume,
        false,
        config.customTimerSoundUrl,
        true,
        config.timerVolume ?? 0.7
      );
    } else {
      playVictoryFanfare(config.volume, config.customAnswerSoundUrl, config.answerVolume ?? 0.8);
    }
  };

  const previewTrack = (track: StoredAudioTrack) => {
    try {
      const audio = new Audio(track.dataUrl);
      audio.volume = config.volume;
      setPlayingTrackId(track.id);
      audio.play().catch((err) => {
        console.warn('Audio play error:', err);
        setPlayingTrackId(null);
      });
      audio.onended = () => setPlayingTrackId(null);
    } catch (err) {
      console.warn('Audio playback failed:', err);
      setPlayingTrackId(null);
    }
  };

  const deleteTrack = async (id: string) => {
    await deleteAudioTrackFromLibrary(id);
    await loadLibrary();
  };

  return (
    <div className="bg-[#121217] border border-white/5 rounded-2xl p-5 space-y-6 text-white shadow-2xl overflow-y-auto max-h-[640px]">
      {/* TTS Master Enable Switch */}
      <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#0a0a0c] border border-white/5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
            <Mic className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
              Free Neural Voiceover Narrator
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                100% Free
              </span>
            </h4>
            <p className="text-[11px] text-white/40">
              Reads question and options aloud with realistic tone and clear pronunciation
            </p>
          </div>
        </div>

        <input
          type="checkbox"
          checked={config.enableTTS}
          onChange={(e) => updateProp('enableTTS', e.target.checked)}
          className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
        />
      </div>

      {/* Voice Selection Studio */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
            <Globe className="w-4 h-4" /> Voice & Host Studio (10 Male & 10 Female Characters)
          </h3>
          <span className="text-[10px] text-white/40 font-bold uppercase">
            {availablePersonas.length} Characters in this Category
          </span>
        </div>

        {/* 1. Language Selector */}
        <div>
          <label className="text-white/50 block mb-1 text-[10px] font-bold uppercase tracking-wider">
            Select Language
          </label>
          <select
            value={config.language}
            onChange={(e) => handleLanguageChange(e.target.value as VoiceLanguage)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#0a0a0c] border border-white/10 text-white outline-none focus:border-indigo-500 font-bold text-xs cursor-pointer"
          >
            {ALL_VOICE_LANGUAGES.map((lang) => (
              <option key={lang.id} value={lang.id} className="bg-[#121217] text-white py-1">
                {lang.flag} {lang.label} ({lang.nativeName})
              </option>
            ))}
          </select>
        </div>

        {/* 2. Male vs Female Voice Switcher (2 Equal Tabs) */}
        <div>
          <label className="text-white/50 block mb-1 text-[10px] font-bold uppercase tracking-wider">
            Select Voice Category
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleGenderChange('male')}
              className={`p-3 rounded-xl text-xs font-bold border transition flex items-center gap-3 ${
                config.voiceGender === 'male'
                  ? 'bg-indigo-600 text-white border-indigo-400 shadow-lg shadow-indigo-600/30'
                  : 'bg-[#0a0a0c] text-white/50 border-white/5 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className="text-2xl">👨</span>
              <div className="text-left">
                <div className="font-black text-xs sm:text-sm flex items-center gap-1.5">
                  Male Host
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 font-mono">10 Voices</span>
                </div>
                <div className="text-[10px] opacity-80 font-normal">Deep, Resonant & Studio Narrators</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleGenderChange('female')}
              className={`p-3 rounded-xl text-xs font-bold border transition flex items-center gap-3 ${
                config.voiceGender === 'female'
                  ? 'bg-pink-600 text-white border-pink-400 shadow-lg shadow-pink-600/30'
                  : 'bg-[#0a0a0c] text-white/50 border-white/5 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className="text-2xl">👩</span>
              <div className="text-left">
                <div className="font-black text-xs sm:text-sm flex items-center gap-1.5">
                  Female Host
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 font-mono">10 Voices</span>
                </div>
                <div className="text-[10px] opacity-80 font-normal">Melodious, Clear & Studio Presenters</div>
              </div>
            </button>
          </div>
        </div>

        {/* 3. Character Cards with Integrated Play/Listen Button */}
        <div className="space-y-2">
          <label className="text-white/50 block text-[10px] font-bold uppercase tracking-wider flex items-center justify-between">
            <span>
              Select Voice & Click Play to Listen (
              {config.voiceGender === 'male' ? '👨 10 Male Characters' : '👩 10 Female Characters'}
              )
            </span>
            <span className="text-indigo-400 font-bold">{selectedPersona?.name} Active</span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {availablePersonas.map((persona) => {
              const isSelected = selectedPersona.id === persona.id;
              const isPlaying = playingPersonaId === persona.id;

              const getGenderIcon = () => {
                if (persona.gender === 'female') return '👩';
                return '👨';
              };

              const getSelectedBorderClass = () => {
                if (!isSelected) return 'bg-[#0a0a0c] border-white/5 hover:border-white/20';
                if (persona.gender === 'female') return 'bg-pink-950/40 border-pink-500/80 shadow-md shadow-pink-900/20';
                return 'bg-indigo-950/40 border-indigo-500/80 shadow-md shadow-indigo-900/20';
              };

              const getButtonClass = () => {
                if (isPlaying) return 'bg-amber-500 text-white animate-pulse';
                if (isSelected) {
                  if (persona.gender === 'female') return 'bg-pink-600 text-white hover:bg-pink-500';
                  return 'bg-indigo-600 text-white hover:bg-indigo-500';
                }
                return 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white';
              };

              return (
                <div
                  key={persona.id}
                  onClick={(e) => handleSelectAndPlayPersona(persona, e)}
                  className={`p-3 rounded-xl border cursor-pointer transition flex flex-col justify-between gap-2 relative group ${getSelectedBorderClass()}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{getGenderIcon()}</span>
                      <div>
                        <span className="text-xs font-black text-white block">{persona.name}</span>
                        <span className="text-[9px] text-white/40">{persona.accent}</span>
                      </div>
                    </div>

                    {/* Integrated Listen & Select Button */}
                    <button
                      type="button"
                      onClick={(e) => handleSelectAndPlayPersona(persona, e)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition shadow-sm ${getButtonClass()}`}
                      title="Click to select and listen to this voice"
                    >
                      {isPlaying ? (
                        <>
                          <Square className="w-3 h-3 fill-current" />
                          <span>Stop</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 fill-current" />
                          <span>{isSelected ? 'Playing' : 'Listen'}</span>
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-[10px] text-white/60 leading-snug">{persona.description}</p>

                  <div className="text-[9px] text-white/40 italic truncate bg-black/30 px-2 py-1 rounded border border-white/5">
                    &ldquo;{persona.previewPhrase}&rdquo;
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. Speech Speed Rate Slider */}
        <div className="pt-2">
          <div className="flex justify-between text-xs text-white/50 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Speech Speed Rate
            </span>
            <span className="font-mono text-indigo-400 font-bold">{config.speechRate}x</span>
          </div>
          <input
            type="range"
            min="0.8"
            max="1.5"
            step="0.05"
            value={config.speechRate}
            onChange={(e) => updateProp('speechRate', parseFloat(e.target.value))}
            className="w-full accent-indigo-600 cursor-pointer"
          />
        </div>
      </div>

      <hr className="border-white/5" />

      {/* Persistent Audio Library / History Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
            <FolderHeart className="w-4 h-4" /> Saved Audio Library (Sound History)
          </h3>
          <span className="text-[10px] text-white/40 font-mono font-bold">
            {libraryTracks.length} Saved Tracks
          </span>
        </div>

        {libraryTracks.length === 0 ? (
          <div className="p-4 rounded-xl bg-[#0a0a0c] border border-dashed border-white/10 text-center space-y-1">
            <p className="text-xs font-bold text-white/60">No saved audio tracks in library</p>
            <p className="text-[10px] text-white/40">
              Upload any MP3/WAV below — it will be automatically saved here permanently so you can
              reuse it anytime without re-uploading!
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
            {libraryTracks.map((track) => (
              <div
                key={track.id}
                className="p-3 rounded-xl bg-[#0a0a0c] border border-white/5 hover:border-emerald-500/30 transition flex items-center justify-between gap-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white truncate block">{track.name}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono shrink-0">
                      {track.fileSizeStr || 'Audio'}
                    </span>
                  </div>
                  <span className="text-[10px] text-white/40 block">
                    Added {new Date(track.uploadedAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      preloadCustomAudio(track.dataUrl);
                      onChange({ ...config, bgMusicUrl: track.dataUrl, enableBgMusic: true });
                    }}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition ${
                      config.bgMusicUrl === track.dataUrl
                        ? 'bg-emerald-600 text-white border-emerald-400'
                        : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:text-white'
                    }`}
                    title="Set as Background Music"
                  >
                    {config.bgMusicUrl === track.dataUrl ? 'Active BG' : '+ BG Music'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      preloadCustomAudio(track.dataUrl);
                      onChange({ ...config, customTimerSoundUrl: track.dataUrl });
                    }}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition ${
                      config.customTimerSoundUrl === track.dataUrl
                        ? 'bg-indigo-600 text-white border-indigo-400'
                        : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:text-white'
                    }`}
                    title="Set as Timer Sound"
                  >
                    {config.customTimerSoundUrl === track.dataUrl ? 'Active Timer' : '+ Timer'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      preloadCustomAudio(track.dataUrl);
                      onChange({ ...config, customAnswerSoundUrl: track.dataUrl });
                    }}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition ${
                      config.customAnswerSoundUrl === track.dataUrl
                        ? 'bg-purple-600 text-white border-purple-400'
                        : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:text-white'
                    }`}
                    title="Set as Answer Chime"
                  >
                    {config.customAnswerSoundUrl === track.dataUrl ? 'Active Answer' : '+ Answer'}
                  </button>

                  <button
                    type="button"
                    onClick={() => previewTrack(track)}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 border border-white/10"
                    title="Preview Audio"
                  >
                    <Play
                      className={`w-3 h-3 ${
                        playingTrackId === track.id ? 'text-emerald-400 animate-pulse' : ''
                      }`}
                    />
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteTrack(track.id)}
                    className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20"
                    title="Delete from Library"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <hr className="border-white/5" />

      {/* Custom Audio Uploads & Sound Effects Section */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
          <Music className="w-4 h-4" /> Background Music & Sound FX Uploads
        </h3>

        {/* Custom Background Music Upload */}
        <div className="p-3.5 rounded-xl bg-[#0a0a0c] border border-white/5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-white block">Background Music Track</span>
              <span className="text-[10px] text-white/40">Custom background music or auto-synthesized track</span>
            </div>
            <input
              type="checkbox"
              checked={config.enableBgMusic !== false}
              onChange={(e) => updateProp('enableBgMusic', e.target.checked)}
              className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="flex-1 cursor-pointer py-2 px-3 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-bold flex items-center justify-center gap-2 transition">
              <Upload className="w-3.5 h-3.5" />
              {config.bgMusicUrl ? 'Upload New Track to Library' : 'Upload MP3/WAV to Library'}
              <input
                type="file"
                accept="audio/*"
                onChange={handleBgMusicUpload}
                className="hidden"
              />
            </label>

            {config.bgMusicUrl && (
              <button
                type="button"
                onClick={() => updateProp('bgMusicUrl', null)}
                className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 text-xs"
                title="Reset to Default Synthesized Track"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Music Volume Slider */}
          <div>
            <div className="flex justify-between text-xs text-white/50 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">
                Music Track Volume
              </span>
              <span className="font-mono text-indigo-400 font-bold">
                {Math.round((config.bgMusicVolume ?? 0.3) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.05"
              max="1.0"
              step="0.05"
              value={config.bgMusicVolume ?? 0.3}
              onChange={(e) => updateProp('bgMusicVolume', parseFloat(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
          </div>

          {/* Smart Voice Over Ducking Toggle */}
          <label className="flex items-center justify-between pt-1 text-xs cursor-pointer">
            <span className="text-[11px] font-bold text-white/80">
              Auto-Duck Music Volume During Voiceover
            </span>
            <input
              type="checkbox"
              checked={config.enableDucking !== false}
              onChange={(e) => updateProp('enableDucking', e.target.checked)}
              className="w-4 h-4 accent-indigo-600 rounded"
            />
          </label>
        </div>

        {/* Custom Timer Sound Upload */}
        <div className="p-3.5 rounded-xl bg-[#0a0a0c] border border-white/5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-white block">Timer Sound / Beep</span>
              <span className="text-[10px] text-white/40">Upload custom mp3/wav audio for timer tick or countdown</span>
            </div>
            {config.customTimerSoundUrl && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold uppercase">
                Custom Selected
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <label className="flex-1 cursor-pointer py-2 px-3 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-bold flex items-center justify-center gap-2 transition">
              <Upload className="w-3.5 h-3.5" /> Upload Audio File
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => handleCustomAudioUpload(e, 'timer')}
                className="hidden"
              />
            </label>

            <button
              type="button"
              onClick={() => testSound('timer')}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 text-xs font-bold flex items-center gap-1"
              title="Test Timer Sound"
            >
              <Play className="w-3.5 h-3.5" />
            </button>

            {config.customTimerSoundUrl && (
              <button
                type="button"
                onClick={() => clearCustomSound('timer')}
                className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 text-xs"
                title="Remove Custom Sound"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Timer Sound Volume Slider */}
          <div>
            <div className="flex justify-between text-xs text-white/50 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">
                Timer Sound Volume
              </span>
              <span className="font-mono text-indigo-400 font-bold">
                {Math.round((config.timerVolume ?? 0.7) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.05"
              value={config.timerVolume ?? 0.7}
              onChange={(e) => updateProp('timerVolume', parseFloat(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
          </div>
        </div>

        {/* Custom Answer Sound Upload */}
        <div className="p-3.5 rounded-xl bg-[#0a0a0c] border border-white/5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-white block">Answer Reveal Sound</span>
              <span className="text-[10px] text-white/40">Upload custom mp3/wav audio for answer reveal chime</span>
            </div>
            {config.customAnswerSoundUrl && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold uppercase">
                Custom Selected
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <label className="flex-1 cursor-pointer py-2 px-3 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-bold flex items-center justify-center gap-2 transition">
              <Upload className="w-3.5 h-3.5" /> Upload Audio File
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => handleCustomAudioUpload(e, 'answer')}
                className="hidden"
              />
            </label>

            <button
              type="button"
              onClick={() => testSound('answer')}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 text-xs font-bold flex items-center gap-1"
              title="Test Answer Sound"
            >
              <Play className="w-3.5 h-3.5" />
            </button>

            {config.customAnswerSoundUrl && (
              <button
                type="button"
                onClick={() => clearCustomSound('answer')}
                className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 text-xs"
                title="Remove Custom Sound"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Answer Reveal Volume Slider */}
          <div>
            <div className="flex justify-between text-xs text-white/50 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">
                Answer Sound Volume
              </span>
              <span className="font-mono text-indigo-400 font-bold">
                {Math.round((config.answerVolume ?? 0.8) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.05"
              value={config.answerVolume ?? 0.8}
              onChange={(e) => updateProp('answerVolume', parseFloat(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
          </div>
        </div>

        {/* Sound Enable Toggles */}
        <div className="space-y-2.5">
          <label className="flex items-center justify-between p-3 rounded-xl bg-[#0a0a0c] border border-white/5 text-xs cursor-pointer hover:border-white/10">
            <span className="font-bold text-white/80">Digital Countdown Beep Sound</span>
            <input
              type="checkbox"
              checked={config.enableBeepSound}
              onChange={(e) => updateProp('enableBeepSound', e.target.checked)}
              className="w-4 h-4 accent-indigo-600 rounded"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-xl bg-[#0a0a0c] border border-white/5 text-xs cursor-pointer hover:border-white/10">
            <span className="font-bold text-white/80">Victory Chime on Answer Reveal</span>
            <input
              type="checkbox"
              checked={config.enableFanfareSound}
              onChange={(e) => updateProp('enableFanfareSound', e.target.checked)}
              className="w-4 h-4 accent-indigo-600 rounded"
            />
          </label>
        </div>

        {/* Master Volume */}
        <div>
          <div className="flex justify-between text-xs text-white/50 mb-1">
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider">
              <Volume2 className="w-3.5 h-3.5" /> Master Volume
            </span>
            <span className="font-mono text-indigo-400 font-bold">
              {Math.round(config.volume * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0.0"
            max="1.0"
            step="0.05"
            value={config.volume}
            onChange={(e) => updateProp('volume', parseFloat(e.target.value))}
            className="w-full accent-indigo-600 cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};

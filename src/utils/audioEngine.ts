// Web Audio API Synthesizer & Custom Audio Player for Quiz Game Show Sound Effects

let audioCtx: AudioContext | null = null;
let streamDestination: MediaStreamAudioDestinationNode | null = null;

const audioBufferCache: Record<string, AudioBuffer> = {};

export function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function getAudioDestinationStream(): MediaStreamAudioDestinationNode {
  const ctx = getAudioContext();
  if (!streamDestination) {
    streamDestination = ctx.createMediaStreamDestination();
    // Add continuous silent oscillator to keep MediaRecorder audio track active and recording
    try {
      const silentOsc = ctx.createOscillator();
      const silentGain = ctx.createGain();
      silentGain.gain.setValueAtTime(0.00001, ctx.currentTime);
      silentOsc.connect(silentGain);
      silentGain.connect(streamDestination);
      silentOsc.start(0);
    } catch (e) {}
  }
  return streamDestination;
}

/**
 * Preloads and decodes a custom audio URL into an AudioBuffer
 */
export async function preloadCustomAudio(url: string): Promise<AudioBuffer | null> {
  if (!url) return null;
  if (audioBufferCache[url]) {
    return audioBufferCache[url];
  }
  try {
    const ctx = getAudioContext();
    const res = await fetch(url);
    const arrayBuffer = await res.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    audioBufferCache[url] = audioBuffer;
    return audioBuffer;
  } catch (err) {
    console.warn('Failed to load custom audio:', err);
    return null;
  }
}

/**
 * Plays a high-tech digital clock countdown tick/beep or custom timer sound
 */
let lastTimerSourceNode: AudioBufferSourceNode | null = null;

export function stopTimerAudio() {
  if (lastTimerSourceNode) {
    try {
      lastTimerSourceNode.stop();
    } catch (e) {}
    lastTimerSourceNode = null;
  }
}

export function playCountdownBeep(
  masterVolume: number = 0.8,
  isFinalTick: boolean = false,
  customSoundUrl?: string | null,
  isFirstTick: boolean = false,
  timerVolume: number = 0.7
) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const effectiveVolume = masterVolume * timerVolume;

    // Check if custom timer sound is provided
    if (customSoundUrl) {
      // If custom audio is already playing continuously and this is a subsequent tick, let it play
      if (!isFirstTick && lastTimerSourceNode) {
        return;
      }

      // Stop previous instance if any
      stopTimerAudio();

      if (audioBufferCache[customSoundUrl]) {
        const buffer = audioBufferCache[customSoundUrl];
        const source = ctx.createBufferSource();
        source.buffer = buffer;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(effectiveVolume * 0.8, now);

        source.connect(gain);
        gain.connect(ctx.destination);
        if (streamDestination) {
          gain.connect(streamDestination);
        }

        lastTimerSourceNode = source;
        source.start(now);
        return;
      } else {
        // Asynchronously load and play if not pre-cached yet
        preloadCustomAudio(customSoundUrl).then(buffer => {
          if (buffer) {
            const freshCtx = getAudioContext();
            const freshNow = freshCtx.currentTime;
            const source = freshCtx.createBufferSource();
            source.buffer = buffer;
            const gain = freshCtx.createGain();
            gain.gain.setValueAtTime(effectiveVolume * 0.8, freshNow);
            source.connect(gain);
            gain.connect(freshCtx.destination);
            if (streamDestination) gain.connect(streamDestination);
            lastTimerSourceNode = source;
            source.start(freshNow);
          }
        });
        return;
      }
    }

    // Default synthesizer tick sound
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = isFinalTick ? 'square' : 'sine';
    osc.frequency.setValueAtTime(isFinalTick ? 880 : 600, now);
    osc.frequency.exponentialRampToValueAtTime(isFinalTick ? 1200 : 400, now + 0.12);

    gain.gain.setValueAtTime(effectiveVolume * 0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);
    if (streamDestination) {
      gain.connect(streamDestination);
    }

    osc.start(now);
    osc.stop(now + 0.15);
  } catch (err) {
    console.warn('Audio play error:', err);
  }
}

/**
 * Plays keyboard typing sound effect: plays manual custom audio file if uploaded,
 * or synthesizes a tactile keystroke clack with pitch jitter and bottom-out resonance.
 */
export function playTypewriterClick(
  masterVolume: number = 0.8,
  typewriterVolume: number = 0.6,
  customSoundUrl?: string | null,
  isSpaceKey: boolean = false
) {
  try {
    const effectiveVol = masterVolume * typewriterVolume;
    if (effectiveVol <= 0.001) return;

    // 1. Play custom uploaded manual audio file if provided
    if (customSoundUrl) {
      const audio = new Audio(customSoundUrl);
      audio.volume = Math.min(1, Math.max(0, effectiveVol));
      audio.play().catch(() => {});
      return;
    }

    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Per-keystroke pitch and resonance micro-variation for realistic typing sensation
    const pitchJitter = 0.88 + Math.random() * 0.24;

    const clickDuration = isSpaceKey ? 0.038 : 0.022;
    const bufferSize = Math.floor(ctx.sampleRate * clickDuration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const decay = Math.exp(-i / (bufferSize * 0.22));
      data[i] = (Math.random() * 2 - 1) * decay;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    // High-frequency tactile switch actuation snap
    const snapFilter = ctx.createBiquadFilter();
    snapFilter.type = 'bandpass';
    const snapFreq = (3200 + Math.random() * 600) * pitchJitter;
    snapFilter.frequency.setValueAtTime(snapFreq, now);
    snapFilter.Q.setValueAtTime(4.2, now);

    const snapGain = ctx.createGain();
    snapGain.gain.setValueAtTime(effectiveVol * 0.7, now);
    snapGain.gain.exponentialRampToValueAtTime(0.0001, now + clickDuration);

    noise.connect(snapFilter);
    snapFilter.connect(snapGain);
    snapGain.connect(ctx.destination);
    if (streamDestination) snapGain.connect(streamDestination);

    // Low-mid key bottom-out "thock" resonance
    const thockOsc = ctx.createOscillator();
    thockOsc.type = 'triangle';
    const baseThump = isSpaceKey ? 140 : 220;
    const thockFreq = (baseThump + Math.random() * 40 - 20) * pitchJitter;
    thockOsc.frequency.setValueAtTime(thockFreq, now);
    thockOsc.frequency.exponentialRampToValueAtTime(isSpaceKey ? 55 : 85, now + (isSpaceKey ? 0.038 : 0.024));

    const thockGain = ctx.createGain();
    thockGain.gain.setValueAtTime(effectiveVol * (isSpaceKey ? 0.6 : 0.45), now);
    thockGain.gain.exponentialRampToValueAtTime(0.0001, now + (isSpaceKey ? 0.038 : 0.024));

    thockOsc.connect(thockGain);
    thockGain.connect(ctx.destination);
    if (streamDestination) thockGain.connect(streamDestination);

    noise.start(now);
    thockOsc.start(now);
    thockOsc.stop(now + (isSpaceKey ? 0.042 : 0.028));
  } catch (err) {
    // Ignore audio glitches
  }
}

/**
 * Plays a triumphant game show victory fanfare chime or custom answer sound on answer reveal
 */
export function playVictoryFanfare(
  masterVolume: number = 0.8,
  customSoundUrl?: string | null,
  answerVolume: number = 0.8
) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const effectiveVolume = masterVolume * answerVolume;

    // Check if custom answer sound is provided
    if (customSoundUrl) {
      if (audioBufferCache[customSoundUrl]) {
        const buffer = audioBufferCache[customSoundUrl];
        const source = ctx.createBufferSource();
        source.buffer = buffer;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(effectiveVolume, now);

        source.connect(gain);
        gain.connect(ctx.destination);
        if (streamDestination) {
          gain.connect(streamDestination);
        }

        source.start(now);
        return;
      } else {
        // Asynchronously load and play if not pre-cached yet
        preloadCustomAudio(customSoundUrl).then(buffer => {
          if (buffer) {
            const freshCtx = getAudioContext();
            const freshNow = freshCtx.currentTime;
            const source = freshCtx.createBufferSource();
            source.buffer = buffer;
            const gain = freshCtx.createGain();
            gain.gain.setValueAtTime(effectiveVolume, freshNow);
            source.connect(gain);
            gain.connect(freshCtx.destination);
            if (streamDestination) gain.connect(streamDestination);
            source.start(freshNow);
          }
        });
        return;
      }
    }

    // Default arpeggio notes for fanfare
    const notes = [523.25, 659.25, 783.99, 1046.50];

    notes.forEach((freq, idx) => {
      const startTime = now + idx * 0.08;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = idx === notes.length - 1 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      const duration = idx === notes.length - 1 ? 0.6 : 0.2;
      gain.gain.setValueAtTime(effectiveVolume * 0.6, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      if (streamDestination) {
        gain.connect(streamDestination);
      }

      osc.start(startTime);
      osc.stop(startTime + duration);
    });
  } catch (err) {
    console.warn('Fanfare sound error:', err);
  }
}

// Background Music Nodes & State
let bgMusicSource: AudioBufferSourceNode | null = null;
let bgMusicGainNode: GainNode | null = null;
let bgMusicIntervalId: any = null;
let currentBgMusicUrl: string | null | undefined = undefined;
let isBgMusicPlaying = false;

/**
 * Starts background music track (using uploaded custom audio or synthesized upbeat game show track)
 */
export async function startBackgroundMusic(
  url?: string | null,
  bgMusicVolume: number = 0.18,
  masterVolume: number = 0.8
) {
  const effectiveVolume = masterVolume * bgMusicVolume;

  // If background music is ALREADY playing for the same track URL, just update volume smoothly
  if (isBgMusicPlaying && currentBgMusicUrl === url) {
    if (bgMusicGainNode && audioCtx) {
      try {
        const now = audioCtx.currentTime;
        bgMusicGainNode.gain.cancelScheduledValues(now);
        bgMusicGainNode.gain.setValueAtTime(bgMusicGainNode.gain.value, now);
        bgMusicGainNode.gain.linearRampToValueAtTime(effectiveVolume, now + 0.2);
      } catch (e) {}
    }
    return;
  }

  stopBackgroundMusic();

  try {
    const ctx = getAudioContext();
    bgMusicGainNode = ctx.createGain();
    bgMusicGainNode.gain.setValueAtTime(effectiveVolume, ctx.currentTime);

    bgMusicGainNode.connect(ctx.destination);
    if (streamDestination) {
      bgMusicGainNode.connect(streamDestination);
    }

    if (url && audioBufferCache[url]) {
      const buffer = audioBufferCache[url];
      bgMusicSource = ctx.createBufferSource();
      bgMusicSource.buffer = buffer;
      bgMusicSource.loop = true;
      bgMusicSource.connect(bgMusicGainNode);
      bgMusicSource.start(0);
      isBgMusicPlaying = true;
      currentBgMusicUrl = url;
    } else if (url) {
      const buffer = await preloadCustomAudio(url);
      if (buffer) {
        bgMusicSource = ctx.createBufferSource();
        bgMusicSource.buffer = buffer;
        bgMusicSource.loop = true;
        bgMusicSource.connect(bgMusicGainNode);
        bgMusicSource.start(0);
        isBgMusicPlaying = true;
        currentBgMusicUrl = url;
      }
    } else {
      // Create a synthesized ambient game show loop
      playSynthBackgroundLoop(ctx, bgMusicGainNode, effectiveVolume);
      isBgMusicPlaying = true;
      currentBgMusicUrl = null;
    }
  } catch (err) {
    console.warn('Failed to start background music:', err);
  }
}

/**
 * Synthesizes a smooth, slow-vibe chill ambient background music loop
 */
function playSynthBackgroundLoop(ctx: AudioContext, masterGain: GainNode, volume: number) {
  // Relaxed slow vibe chord progressions (Cmaj7 -> Am7 -> Fmaj7 -> G7)
  const chords = [
    [130.81, 164.81, 196.00, 246.94], // Cmaj7
    [110.00, 130.81, 164.81, 196.00], // Am7
    [174.61, 220.00, 261.63, 329.63], // Fmaj7
    [196.00, 246.94, 293.66, 349.23], // G7
  ];
  let step = 0;

  bgMusicIntervalId = setInterval(() => {
    try {
      if (!bgMusicGainNode) return;
      const now = ctx.currentTime;
      const chord = chords[Math.floor(step / 2) % chords.length];

      // Soft lowpass filter for chill/slow vibe atmosphere
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(550, now);

      const chordGain = ctx.createGain();
      chordGain.gain.setValueAtTime(0.001, now);
      chordGain.gain.linearRampToValueAtTime(volume * 0.15, now + 0.15);
      chordGain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);

      chordGain.connect(filter);
      filter.connect(masterGain);

      chord.forEach((freq) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        osc.connect(chordGain);
        osc.start(now);
        osc.stop(now + 0.8);
      });

      step++;
    } catch (e) {
      // Context stopped or reset
    }
  }, 800);
}

/**
 * Adjusts background music volume dynamically
 */
export function setBackgroundMusicVolume(targetVolume: number, rampTimeSec: number = 0.2) {
  if (!bgMusicGainNode || !audioCtx) return;
  try {
    const now = audioCtx.currentTime;
    bgMusicGainNode.gain.cancelScheduledValues(now);
    bgMusicGainNode.gain.setValueAtTime(bgMusicGainNode.gain.value, now);
    bgMusicGainNode.gain.linearRampToValueAtTime(targetVolume, now + rampTimeSec);
  } catch (err) {
    console.warn('Error adjusting bg music volume:', err);
  }
}

/**
 * Ducks background music during TTS voiceover narration
 */
export function duckBackgroundMusic(isVoiceOverActive: boolean, baseVolume: number = 0.3) {
  if (isVoiceOverActive) {
    // Duck volume to 20% of base
    setBackgroundMusicVolume(baseVolume * 0.2, 0.2);
  } else {
    // Restore base volume smoothly
    setBackgroundMusicVolume(baseVolume, 0.3);
  }
}

/**
 * Stops background music
 */
export function stopBackgroundMusic() {
  isBgMusicPlaying = false;
  currentBgMusicUrl = undefined;
  if (bgMusicIntervalId) {
    clearInterval(bgMusicIntervalId);
    bgMusicIntervalId = null;
  }
  if (bgMusicSource) {
    try {
      bgMusicSource.stop();
      bgMusicSource.disconnect();
    } catch (e) {}
    bgMusicSource = null;
  }
  if (bgMusicGainNode) {
    try {
      bgMusicGainNode.disconnect();
    } catch (e) {}
    bgMusicGainNode = null;
  }
}

// =========================================================================
// Intro & Outro Audio Player (Routes through Web Audio API to speakers and recording destination)
// =========================================================================
let introOutroSource: AudioBufferSourceNode | null = null;
let introOutroGainNode: GainNode | null = null;

export function stopIntroOutroAudio() {
  if (introOutroSource) {
    try {
      introOutroSource.stop();
      introOutroSource.disconnect();
    } catch (e) {}
    introOutroSource = null;
  }
  if (introOutroGainNode) {
    try {
      introOutroGainNode.disconnect();
    } catch (e) {}
    introOutroGainNode = null;
  }
}

export async function playIntroMediaAudio(
  url?: string | null,
  masterVolume: number = 0.8,
  volumeScale: number = 1.0
): Promise<void> {
  stopIntroOutroAudio();
  if (!url) return;

  try {
    const ctx = getAudioContext();
    const buffer = await preloadCustomAudio(url);
    if (buffer) {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(Math.min(1.0, masterVolume * volumeScale), ctx.currentTime);
      source.connect(gain);
      gain.connect(ctx.destination);
      if (streamDestination) {
        gain.connect(streamDestination);
      }
      introOutroSource = source;
      introOutroGainNode = gain;
      source.start(ctx.currentTime);
    }
  } catch (err) {
    console.warn('Intro audio playback error:', err);
  }
}

export async function playOutroMediaAudio(
  url?: string | null,
  masterVolume: number = 0.8,
  volumeScale: number = 1.0
): Promise<void> {
  stopIntroOutroAudio();
  if (!url) return;

  try {
    const ctx = getAudioContext();
    const buffer = await preloadCustomAudio(url);
    if (buffer) {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(Math.min(1.0, masterVolume * volumeScale), ctx.currentTime);
      source.connect(gain);
      gain.connect(ctx.destination);
      if (streamDestination) {
        gain.connect(streamDestination);
      }
      introOutroSource = source;
      introOutroGainNode = gain;
      source.start(ctx.currentTime);
    }
  } catch (err) {
    console.warn('Outro audio playback error:', err);
  }
}


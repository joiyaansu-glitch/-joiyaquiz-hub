import React, { useEffect, useRef } from 'react';
import { QuizItem, QuizThemeConfig, QuizPlaybackState, OptionLetter, IntroOutroConfig, AudioConfig } from '../types';

export interface TypewriterState {
  questionText: string;
  isQuestionTyping: boolean;
  optionsText: string[];
  activeOptionIndex: number;
  totalCharsTyped: number;
  isComplete: boolean;
}

export function computeTypewriterState(
  question: QuizItem,
  elapsedMs: number,
  enabled: boolean = true
): TypewriterState {
  if (!enabled) {
    const qLen = (question.question || '').length;
    const optLens = (question.options || []).map((o) => (o || '').length);
    const total = qLen + optLens.reduce((a, b) => a + b, 0);
    return {
      questionText: question.question || '',
      isQuestionTyping: false,
      optionsText: question.options ? [...question.options] : [],
      activeOptionIndex: -1,
      totalCharsTyped: total,
      isComplete: true,
    };
  }

  // Standard smooth fluid typing speed, tuned to roughly match natural narration
  // pace (~150-165 words/min ≈ 60ms/char) instead of a much faster fixed rate —
  // previously the text finished typing well before the narrator finished
  // speaking it, so it sat static/"frozen" for the rest of the narration.
  const msPerChar = 58;
  const pauseBetweenQandOptions = 120;
  const pauseBetweenOptions = 80;

  const fullQuestion = question.question || '';
  const qCharCount = fullQuestion.length;
  const qDuration = qCharCount * msPerChar;

  let currentTime = elapsedMs;
  let totalChars = 0;

  // 1. Question typing phase
  if (currentTime < qDuration) {
    const charsToShow = Math.max(1, Math.min(qCharCount, Math.floor(currentTime / msPerChar) + 1));
    totalChars += charsToShow;
    return {
      questionText: fullQuestion.slice(0, charsToShow),
      isQuestionTyping: true,
      optionsText: ['', '', '', ''],
      activeOptionIndex: -1,
      totalCharsTyped: totalChars,
      isComplete: false,
    };
  }

  const finalQuestionText = fullQuestion;
  totalChars += qCharCount;
  currentTime -= (qDuration + pauseBetweenQandOptions);

  if (currentTime <= 0) {
    return {
      questionText: finalQuestionText,
      isQuestionTyping: false,
      optionsText: ['', '', '', ''],
      activeOptionIndex: -1,
      totalCharsTyped: totalChars,
      isComplete: false,
    };
  }

  // 2. Options sequential typing phase (A -> B -> C -> D)
  const optionsResult: string[] = ['', '', '', ''];
  let currentActiveOpt = -1;
  let allOptionsComplete = true;

  for (let i = 0; i < 4; i++) {
    const optFull = (question.options && question.options[i]) || '';
    const optLen = optFull.length;
    const optDuration = Math.max(1, optLen) * msPerChar;

    if (currentTime < optDuration) {
      const charsToShow = Math.max(1, Math.min(optLen, Math.floor(currentTime / msPerChar) + 1));
      optionsResult[i] = optFull.slice(0, charsToShow);
      currentActiveOpt = i;
      totalChars += charsToShow;
      allOptionsComplete = false;
      break;
    } else {
      optionsResult[i] = optFull;
      totalChars += optLen;
      currentTime -= (optDuration + pauseBetweenOptions);
      if (currentTime <= 0 && i < 3) {
        allOptionsComplete = false;
        break;
      }
    }
  }

  return {
    questionText: finalQuestionText,
    isQuestionTyping: false,
    optionsText: optionsResult,
    activeOptionIndex: currentActiveOpt,
    totalCharsTyped: totalChars,
    isComplete: allOptionsComplete,
  };
}

interface QuizCanvasProps {
  question: QuizItem | null;
  questionIndex: number;
  totalQuestions: number;
  theme: QuizThemeConfig;
  playbackState: QuizPlaybackState;
  timerSeconds: number;
  audioConfig?: AudioConfig;
  introOutro?: IntroOutroConfig;
  width?: number;
  height?: number;
  onCanvasRef?: (canvas: HTMLCanvasElement | null) => void;
}

export const QuizCanvas: React.FC<QuizCanvasProps> = ({
  question,
  questionIndex,
  totalQuestions,
  theme,
  playbackState,
  timerSeconds,
  audioConfig,
  introOutro,
  width = 1920,
  height = 1080,
  onCanvasRef,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const customMascotImgRef = useRef<HTMLImageElement | null>(null);
  const introVideoRef = useRef<HTMLVideoElement | null>(null);
  const introImgRef = useRef<HTMLImageElement | null>(null);
  const outroVideoRef = useRef<HTMLVideoElement | null>(null);
  const outroImgRef = useRef<HTMLImageElement | null>(null);

  // Transition & typewriter tracking refs
  const prevQuestionRef = useRef<QuizItem | null>(null);
  const prevQuestionIndexRef = useRef<number>(questionIndex);
  const currentQuestionRef = useRef<QuizItem | null>(question);
  const transitionStartRef = useRef<number | null>(null);
  const questionStartTimeRef = useRef<number>(performance.now());
  const lastTypedCharsRef = useRef<number>(0);
  // Wall-clock timestamp of the moment the current whole-second `timerSeconds`
  // value was received. Used to interpolate a smooth, continuously-decreasing
  // value between one-second ticks so the loading bar / clock hand glide
  // instead of visibly jumping once per second.
  const timerTickTimeRef = useRef<number>(performance.now());

  // Preload mascot image
  useEffect(() => {
    if (theme.customMascotUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = theme.customMascotUrl;
      img.onload = () => {
        customMascotImgRef.current = img;
      };
    } else {
      customMascotImgRef.current = null;
    }
  }, [theme.customMascotUrl]);

  // Preload Intro video/image media
  useEffect(() => {
    if (introOutro?.introVideoUrl) {
      const url = introOutro.introVideoUrl;
      const isImage = url.startsWith('data:image') || /\.(jpeg|jpg|gif|png|webp)($|\?)/i.test(url);
      if (isImage) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = url;
        introImgRef.current = img;
        if (introVideoRef.current) {
          introVideoRef.current.pause();
          introVideoRef.current = null;
        }
      } else {
        const vid = document.createElement('video');
        vid.src = url;
        vid.crossOrigin = 'anonymous';
        vid.muted = true;
        vid.playsInline = true;
        vid.loop = true;
        vid.preload = 'auto';
        vid.load();
        introVideoRef.current = vid;
        introImgRef.current = null;
      }
    } else {
      if (introVideoRef.current) {
        introVideoRef.current.pause();
        introVideoRef.current = null;
      }
      introImgRef.current = null;
    }
  }, [introOutro?.introVideoUrl]);

  // Preload Outro video/image media
  useEffect(() => {
    if (introOutro?.outroVideoUrl) {
      const url = introOutro.outroVideoUrl;
      const isImage = url.startsWith('data:image') || /\.(jpeg|jpg|gif|png|webp)($|\?)/i.test(url);
      if (isImage) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = url;
        outroImgRef.current = img;
        if (outroVideoRef.current) {
          outroVideoRef.current.pause();
          outroVideoRef.current = null;
        }
      } else {
        const vid = document.createElement('video');
        vid.src = url;
        vid.crossOrigin = 'anonymous';
        vid.muted = true;
        vid.playsInline = true;
        vid.loop = true;
        vid.preload = 'auto';
        vid.load();
        outroVideoRef.current = vid;
        outroImgRef.current = null;
      }
    } else {
      if (outroVideoRef.current) {
        outroVideoRef.current.pause();
        outroVideoRef.current = null;
      }
      outroImgRef.current = null;
    }
  }, [introOutro?.outroVideoUrl]);

  // Play/pause intro & outro videos based on playbackState
  useEffect(() => {
    if (playbackState === 'intro') {
      if (introVideoRef.current) {
        introVideoRef.current.currentTime = 0;
        introVideoRef.current.play().catch(() => {});
      }
    } else {
      if (introVideoRef.current && !introVideoRef.current.paused) {
        introVideoRef.current.pause();
      }
    }

    if (playbackState === 'outro') {
      if (outroVideoRef.current) {
        outroVideoRef.current.currentTime = 0;
        outroVideoRef.current.play().catch(() => {});
      }
    } else {
      if (outroVideoRef.current && !outroVideoRef.current.paused) {
        outroVideoRef.current.pause();
      }
    }
  }, [playbackState]);

  useEffect(() => {
    if (onCanvasRef && canvasRef.current) {
      onCanvasRef(canvasRef.current);
    }
  }, [onCanvasRef]);

  // Track question transitions and reset typewriter start
  useEffect(() => {
    if (currentQuestionRef.current && question && currentQuestionRef.current.id !== question.id) {
      prevQuestionRef.current = currentQuestionRef.current;
      prevQuestionIndexRef.current = questionIndex > 0 ? questionIndex - 1 : 0;
      transitionStartRef.current = performance.now();
      questionStartTimeRef.current = performance.now() + 500; // start typing right as enter transition begins
      lastTypedCharsRef.current = 0;
    } else if (!currentQuestionRef.current && question) {
      questionStartTimeRef.current = performance.now();
      lastTypedCharsRef.current = 0;
    }
    currentQuestionRef.current = question;
  }, [question, questionIndex]);

  // Handle explicit transitioning or reading state trigger
  useEffect(() => {
    if (playbackState === 'transitioning') {
      transitionStartRef.current = performance.now();
      questionStartTimeRef.current = performance.now() + 500;
      lastTypedCharsRef.current = 0;
    } else if (playbackState === 'reading') {
      questionStartTimeRef.current = performance.now();
      lastTypedCharsRef.current = 0;
    }
  }, [playbackState]);

  // Mark the moment each new whole-second countdown tick arrives, so the render
  // loop can interpolate a smooth, gliding value instead of a once-per-second jump.
  useEffect(() => {
    timerTickTimeRef.current = performance.now();
  }, [timerSeconds]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrameId: number;

    const render = () => {
      const currentCanvasWidth = canvas.width;
      const currentCanvasHeight = canvas.height;

      // Always clear the full physical canvas buffer
      ctx.clearRect(0, 0, currentCanvasWidth, currentCanvasHeight);

      // Standard logical coordinate reference for 16:9 YouTube Widescreen (1920 x 1080)
      const baseW = 1920;
      const baseH = 1080;

      // Proportional scale transform (works for 720p, 1080p, 4K, and any preview sizes)
      ctx.save();
      const scaleX = currentCanvasWidth / baseW;
      const scaleY = currentCanvasHeight / baseH;
      ctx.scale(scaleX, scaleY);

      // -------------------------------------------------------------
      // 1. BACKGROUND & AMBIENT GLOW
      // -------------------------------------------------------------
      drawBackground(ctx, baseW, baseH, theme);

      if (playbackState === 'intro') {
        drawIntroCard(ctx, baseW, baseH, introOutro, theme, introVideoRef.current, introImgRef.current);
        ctx.restore();
        animFrameId = requestAnimationFrame(render);
        return;
      }

      if (playbackState === 'outro') {
        drawOutroCard(ctx, baseW, baseH, introOutro, theme, outroVideoRef.current, outroImgRef.current);
        ctx.restore();
        animFrameId = requestAnimationFrame(render);
        return;
      }

      if (!question) {
        // Render Empty state
        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 54px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No Quiz Questions Available', baseW / 2, baseH / 2);
        ctx.restore();
        return;
      }

      // Compute Typewriter Animation progress
      const now = performance.now();
      const isCountdownOrReveal = playbackState === 'countdown' || playbackState === 'reveal' || playbackState === 'revealed';
      const typewriterElapsed = isCountdownOrReveal
        ? 999999
        : Math.max(0, now - questionStartTimeRef.current);

      const typeState = computeTypewriterState(
        question,
        typewriterElapsed,
        theme.enableTypewriter !== false
      );

      // -------------------------------------------------------------
      // 2. 1-SECOND QUESTION TRANSITION ANIMATION
      // -------------------------------------------------------------
      const elapsed = transitionStartRef.current ? now - transitionStartRef.current : 99999;
      const isTransitioning = (playbackState === 'transitioning' || elapsed < 1000) && prevQuestionRef.current !== null && prevQuestionRef.current.id !== question.id;

      if (isTransitioning && prevQuestionRef.current) {
        const rawT = Math.min(1, Math.max(0, elapsed / 1000));
        const easeT = rawT < 0.5
          ? 4 * rawT * rawT * rawT
          : 1 - Math.pow(-2 * rawT + 2, 3) / 2;

        if (easeT < 0.5) {
          // Phase 1 (0.0s to 0.5s): Previous Question Animates Out
          const exitT = easeT / 0.5;
          ctx.save();
          ctx.translate(-exitT * 160, 0);
          ctx.globalAlpha = Math.max(0, 1 - exitT);

          drawQuestionCapsule(ctx, baseW, baseH, prevQuestionRef.current.question, prevQuestionIndexRef.current, theme, false);
          drawOptionsList(ctx, baseW, baseH, prevQuestionRef.current, 'reveal', theme);
          drawTimerWidget(ctx, baseW, baseH, 0, theme);
          ctx.restore();
        } else {
          // Phase 2 (0.5s to 1.0s): New Question Animates In
          const enterT = (easeT - 0.5) / 0.5;
          ctx.save();
          ctx.translate((1 - enterT) * 160, 0);
          ctx.globalAlpha = Math.min(1, enterT);

          drawQuestionCapsule(ctx, baseW, baseH, typeState.questionText, questionIndex, theme, typeState.isQuestionTyping);
          drawOptionsList(ctx, baseW, baseH, question, 'reading', theme, typeState.optionsText, typeState.activeOptionIndex);
          drawTimerWidget(ctx, baseW, baseH, theme.timerDuration, theme);
          ctx.restore();
        }
      } else {
        // Normal Stable Render with Typewriter effect
        drawQuestionCapsule(ctx, baseW, baseH, typeState.questionText, questionIndex, theme, typeState.isQuestionTyping);
        drawOptionsList(ctx, baseW, baseH, question, playbackState, theme, typeState.optionsText, typeState.activeOptionIndex);
        // Hide the countdown timer widget once the answer is being revealed —
        // leaving it on screen made it look like the timer was "still running"
        // at the same time as the correct-answer highlight and explanation.
        if (playbackState !== 'reveal' && playbackState !== 'revealed') {
          // Interpolate a smoothly-decreasing value between the once-per-second
          // timerSeconds ticks so the loading bar / clock hand glide continuously
          // instead of visibly jumping in whole-second steps.
          const msSinceTick = now - timerTickTimeRef.current;
          const smoothTimerSeconds = playbackState === 'countdown'
            ? Math.max(0, timerSeconds - msSinceTick / 1000)
            : timerSeconds;
          drawTimerWidget(ctx, baseW, baseH, smoothTimerSeconds, theme);
        }
        if (playbackState === 'reveal' && question.explanation) {
          drawExplanationCaption(ctx, baseW, baseH, question.explanation, theme);
        }
      }

      ctx.restore();

      animFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animFrameId);
    };
  }, [question, questionIndex, totalQuestions, theme, playbackState, timerSeconds, audioConfig, width, height]);

  return (
    <div className="relative w-full aspect-video rounded-xl overflow-hidden shadow-2xl border border-white/10 bg-black">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="w-full h-full object-contain"
      />
    </div>
  );
};

// ============================================================================
// CANVAS DRAWING HELPER FUNCTIONS (OPTIMIZED FOR 16:9 NO-DEAD-SPACE LAYOUT)
// ============================================================================

function drawBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  theme: QuizThemeConfig
) {
  // Base background fill
  if (theme.canvasBg.includes('gradient')) {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#334155');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
  } else {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#f8fafc');
    grad.addColorStop(0.5, theme.canvasBg);
    grad.addColorStop(1, '#94a3b8');
    ctx.fillStyle = grad;
  }
  ctx.fillRect(0, 0, w, h);

  // Right Side Ambient Backdrop Light Orb behind Mascot to prevent dead dark space
  ctx.save();
  const rightGlow = ctx.createRadialGradient(w - 300, 550, 50, w - 300, 550, 600);
  rightGlow.addColorStop(0, 'rgba(99, 102, 241, 0.25)');
  rightGlow.addColorStop(0.5, 'rgba(59, 130, 246, 0.12)');
  rightGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = rightGlow;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // Decorative Metallic Curves / Waves matching 16:9 stage layout
  if (theme.bgPattern === 'waves') {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-100, h * 0.7);
    ctx.bezierCurveTo(w * 0.3, h * 0.4, w * 0.7, h * 0.9, w + 100, h * 0.6);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(-100, h * 0.85);
    ctx.bezierCurveTo(w * 0.4, h * 0.55, w * 0.8, h * 0.95, w + 100, h * 0.75);
    ctx.stroke();
    ctx.restore();
  } else if (theme.bgPattern === 'grid') {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 2;
    for (let x = 0; x < w; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 60) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawQuestionCapsule(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  text: string,
  questionIndex: number,
  theme: QuizThemeConfig,
  isTyping: boolean = false
) {
  ctx.save();

  const boxW = w - 120; // 1800px full width (from x=60 to x=1860)
  const boxH = 210;
  const boxX = 60;
  const boxY = 68;
  const radius = 45;

  // Outer Glossy Black Frame / Rim
  ctx.beginPath();
  roundRectPath(ctx, boxX - 8, boxY - 8, boxW + 16, boxH + 16, radius + 8);
  const frameGrad = ctx.createLinearGradient(boxX, boxY, boxX, boxY + boxH);
  frameGrad.addColorStop(0, '#475569');
  frameGrad.addColorStop(0.5, '#0f172a');
  frameGrad.addColorStop(1, '#334155');
  ctx.fillStyle = frameGrad;
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 12;
  ctx.fill();

  // Inner Colored Capsule Fill (e.g. Glossy Orange / Indigo / Crimson)
  ctx.shadowColor = 'transparent';
  ctx.beginPath();
  roundRectPath(ctx, boxX, boxY, boxW, boxH, radius);

  const innerGrad = ctx.createLinearGradient(boxX, boxY, boxX, boxY + boxH);
  innerGrad.addColorStop(0, lightenColor(theme.questionBoxColor, 35));
  innerGrad.addColorStop(0.4, theme.questionBoxColor);
  innerGrad.addColorStop(1, darkenColor(theme.questionBoxColor, 35));
  ctx.fillStyle = innerGrad;
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#000000';
  ctx.stroke();

  // Glossy Top Glass Highlight Reflection
  ctx.beginPath();
  ctx.ellipse(boxX + boxW / 2, boxY + 30, boxW * 0.44, 28, 0, Math.PI, 0, true);
  const glassGrad = ctx.createLinearGradient(0, boxY, 0, boxY + 60);
  glassGrad.addColorStop(0, 'rgba(255, 255, 255, 0.65)');
  glassGrad.addColorStop(1, 'rgba(255, 255, 255, 0.05)');
  ctx.fillStyle = glassGrad;
  ctx.fill();

  // Left Side Circular Badge for Question Numbering
  const badgeRadius = 65;
  const badgeX = boxX + badgeRadius + 30;
  const badgeY = boxY + boxH / 2;

  ctx.beginPath();
  ctx.arc(badgeX, badgeY, badgeRadius, 0, Math.PI * 2);
  const badgeColor = theme.optionBadgeColor || '#ff6b00';
  const badgeGrad = ctx.createRadialGradient(
    badgeX - 15,
    badgeY - 15,
    6,
    badgeX,
    badgeY,
    badgeRadius
  );
  badgeGrad.addColorStop(0, lightenColor(badgeColor, 45));
  badgeGrad.addColorStop(0.7, badgeColor);
  badgeGrad.addColorStop(1, darkenColor(badgeColor, 35));
  ctx.fillStyle = badgeGrad;
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 12;
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();

  // Question Number inside Badge
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = theme.optionBadgeTextColor || '#000000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 58px "Arial Black", Impact, sans-serif';
  ctx.fillText(`${questionIndex + 1}`, badgeX, badgeY + 2);

  // -------------------------------------------------------------
  // AUTOMATIC CENTERED & JUSTIFIED AUTO-FITTING QUESTION TEXT
  // Never goes outside the box regardless of question length
  // -------------------------------------------------------------
  const fontFam = getFontFamilyString(theme.fontFamily);
  const baseFontSize =
    theme.fontSize === '64px' ? 64 :
    theme.fontSize === '70px' ? 70 :
    theme.fontSize === 'sm' ? 56 :
    theme.fontSize === 'lg' ? 74 :
    theme.fontSize === 'xl' ? 80 : 68;

  const textLeftBound = badgeX + badgeRadius + 35;
  const textRightBound = boxX + boxW - 55;
  const maxTextWidth = textRightBound - textLeftBound;
  const textCenterX = (textLeftBound + textRightBound) / 2;
  const textCenterY = boxY + boxH / 2 + 2;
  const maxTextHeight = boxH - 42; // Safe vertical boundary

  drawAutoFitText(
    ctx,
    text,
    textLeftBound,
    textCenterX,
    textCenterY,
    maxTextWidth,
    maxTextHeight,
    baseFontSize,
    fontFam,
    theme.questionTextColor || '#ffffff',
    isTyping,
    theme.questionAlign || 'left'
  );

  ctx.restore();
}

function drawOptionsList(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  question: QuizItem,
  playbackState: QuizPlaybackState,
  theme: QuizThemeConfig,
  optionsText?: string[],
  activeOptionIndex: number = -1
) {
  const letters: OptionLetter[] = ['A', 'B', 'C', 'D'];
  const startY = 305;
  const rowHeight = 162;
  const optionW = 1250; // Stopped at X=1310, leaving right side open (1310 to 1860)
  const optionH = 140;  // Roomier, spacious height (khula box)
  const startX = 60;

  letters.forEach((letter, idx) => {
    const y = startY + idx * rowHeight;
    const optionText = optionsText ? (optionsText[idx] ?? '') : (question.options[idx] || '');
    const normAnswer = String(question.answer || 'A').trim().toUpperCase().charAt(0);
    const isCorrect = normAnswer === letter;
    const isReveal = playbackState === 'reveal';
    const isTyping = activeOptionIndex === idx;

    drawSingleOption(
      ctx,
      startX,
      y,
      optionW,
      optionH,
      letter,
      optionText,
      isCorrect,
      isReveal,
      theme,
      isTyping
    );
  });
}

function drawExplanationCaption(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  explanation: string,
  theme: QuizThemeConfig
) {
  if (!explanation) return;

  const boxX = 60;
  const boxY = 958;
  const boxW = 1250;
  const boxH = 104;

  ctx.save();

  // Semi-transparent dark caption panel with accent left edge
  ctx.beginPath();
  roundRectPath(ctx, boxX, boxY, boxW, boxH, 20);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 4;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 2;
  ctx.strokeStyle = theme.correctHighlightColor || '#fbbf24';
  ctx.stroke();

  // Little "why" bulb icon on the left
  ctx.font = '44px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('💡', boxX + 62, boxY + boxH / 2 + 2);

  // Explanation text, auto-fit and wrapped
  const fontFam = getFontFamilyString(theme.fontFamily);
  drawAutoFitText(
    ctx,
    explanation,
    boxX + 116,
    boxX + 116,
    boxY + boxH / 2,
    boxW - 150,
    boxH - 20,
    30,
    fontFam,
    '#f1f5f9',
    false,
    'left'
  );

  ctx.restore();
}

function drawSingleOption(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  letter: OptionLetter,
  text: string,
  isCorrect: boolean,
  isReveal: boolean,
  theme: QuizThemeConfig,
  isTyping: boolean = false
) {
  ctx.save();

  const isHighlighted = isReveal && isCorrect;
  const isDimmed = isReveal && !isCorrect;

  if (isDimmed) {
    ctx.globalAlpha = 0.45;
  }

  // 1. Glossy Outer Silver Border Box
  const borderRadius = h / 2;
  ctx.beginPath();
  roundRectPath(ctx, x - 5, y - 5, w + 10, h + 10, borderRadius + 5);
  const outerGrad = ctx.createLinearGradient(x, y, x, y + h);
  outerGrad.addColorStop(0, '#f1f5f9');
  outerGrad.addColorStop(1, '#334155');
  ctx.fillStyle = outerGrad;
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 6;
  ctx.fill();

  // 2. Main Horizontal Option Capsule Box
  const boxColor = isHighlighted ? theme.correctHighlightColor : theme.optionBoxColor;

  ctx.beginPath();
  roundRectPath(ctx, x, y, w, h, borderRadius);
  const boxGrad = ctx.createLinearGradient(x, y, x, y + h);
  boxGrad.addColorStop(0, lightenColor(boxColor, 35));
  boxGrad.addColorStop(0.4, boxColor);
  boxGrad.addColorStop(1, darkenColor(boxColor, 35));
  ctx.fillStyle = boxGrad;

  if (isHighlighted) {
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 35;
  } else {
    ctx.shadowColor = 'transparent';
  }
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#000000';
  ctx.stroke();

  // Option Glass Shine
  ctx.beginPath();
  roundRectPath(ctx, x + 30, y + 5, w - 60, (h / 2) - 4, (h / 4));
  const glassGrad = ctx.createLinearGradient(x, y, x, y + h / 2);
  glassGrad.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
  glassGrad.addColorStop(1, 'rgba(255, 255, 255, 0.05)');
  ctx.fillStyle = glassGrad;
  ctx.fill();

  // 3. Circular Letter Pill Badge (Pill on Left)
  const badgeRadius = 58;
  const badgeX = x + badgeRadius + 10;
  const badgeY = y + h / 2;

  ctx.beginPath();
  ctx.arc(badgeX, badgeY, badgeRadius, 0, Math.PI * 2);
  const badgeColor = isHighlighted ? theme.correctBadgeColor : theme.optionBadgeColor;
  const badgeGrad = ctx.createRadialGradient(
    badgeX - 12,
    badgeY - 12,
    6,
    badgeX,
    badgeY,
    badgeRadius
  );
  badgeGrad.addColorStop(0, lightenColor(badgeColor, 40));
  badgeGrad.addColorStop(0.7, badgeColor);
  badgeGrad.addColorStop(1, darkenColor(badgeColor, 35));
  ctx.fillStyle = badgeGrad;
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 10;
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();

  // Letter Text ('A', 'B', 'C', 'D')
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = theme.optionBadgeTextColor || '#000000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 56px "Arial Black", Impact, sans-serif';
  ctx.fillText(letter, badgeX, badgeY + 2);

  // 4. Option Answer Text with Auto-Fit Scaling and Typewriter Cursor
  ctx.fillStyle = theme.optionTextColor || '#000000';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const fontFam = getFontFamilyString(theme.fontFamily);
  const baseOptionFontSize =
    theme.fontSize === '64px' ? 60 :
    theme.fontSize === '70px' ? 66 :
    theme.fontSize === 'sm' ? 50 :
    theme.fontSize === 'lg' ? 64 :
    theme.fontSize === 'xl' ? 70 : 58;

  const maxOptionWidth = w - badgeRadius * 2 - 210;
  let optionFontSize = baseOptionFontSize;

  const cursorChar = isTyping ? '▌' : '';
  const textWithCursor = text ? `${text}${cursorChar}` : cursorChar;

  if (textWithCursor) {
    ctx.font = `bold ${optionFontSize}px ${fontFam}`;
    while (ctx.measureText(textWithCursor).width > maxOptionWidth && optionFontSize > 26) {
      optionFontSize -= 2;
      ctx.font = `bold ${optionFontSize}px ${fontFam}`;
    }

    ctx.fillText(textWithCursor, badgeX + badgeRadius + 30, y + h / 2 + 2, maxOptionWidth);
  }

  // Correct Checkmark Icon & Celebration Emoji when Revealed
  if (isHighlighted) {
    const showEmoji = theme.enableRevealEmoji !== false;
    const revealEmoji = theme.correctRevealEmoji || '🎉';

    // 1. Draw Celebration Emoji (e.g., 🎉, 🥳, 🎯, etc.)
    if (showEmoji && revealEmoji) {
      ctx.font = '52px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(revealEmoji, x + w - 108, y + h / 2 + 1);
    }

    // 2. Draw Bold Green Checkmark Icon
    ctx.fillStyle = '#16a34a';
    ctx.font = '900 52px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✓', x + w - 46, y + h / 2 + 2);
  }

  ctx.restore();
}

function drawTimerWidget(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  seconds: number,
  theme: QuizThemeConfig
) {
  const style = theme.timerStyle || 'clock';
  if (style === 'digital') {
    drawDigitalTimer(ctx, w, h, seconds, theme);
  } else if (style === 'bar') {
    drawLoadingBarTimer(ctx, w, h, seconds, theme);
  } else {
    drawAnalogClockTimer(ctx, w, h, seconds, theme);
  }
}

function getTimerHandColor(theme: QuizThemeConfig): string {
  let handColor = '#10b981'; // Green default
  if (theme.timerColor === 'red') handColor = '#ef4444';
  if (theme.timerColor === 'cyan') handColor = '#06b6d4';
  if (theme.timerColor === 'yellow') handColor = '#f59e0b';
  if (theme.timerColor === 'blue') handColor = '#3b82f6';
  if (theme.timerColor === 'purple') handColor = '#a855f7';
  if (theme.timerColor === 'orange') handColor = '#f97316';
  return handColor;
}

function drawDigitalTimer(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  seconds: number,
  theme: QuizThemeConfig
) {
  ctx.save();

  const maxSeconds = theme.timerDuration || 10;
  const currentSec = Math.max(0, Math.min(maxSeconds, seconds));
  const displaySec = Math.ceil(currentSec);

  const centerX = 1585;
  const centerY = 620;
  const boxW = 220;
  const boxH = 150;
  const color = getTimerHandColor(theme);

  // Outer bezel
  roundRectPath(ctx, centerX - boxW / 2 - 10, centerY - boxH / 2 - 10, boxW + 20, boxH + 20, 24);
  const bezelGrad = ctx.createLinearGradient(centerX - boxW / 2, centerY - boxH / 2, centerX + boxW / 2, centerY + boxH / 2);
  bezelGrad.addColorStop(0, '#475569');
  bezelGrad.addColorStop(1, '#0f172a');
  ctx.fillStyle = bezelGrad;
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 10;
  ctx.fill();

  // Dark LCD screen
  roundRectPath(ctx, centerX - boxW / 2, centerY - boxH / 2, boxW, boxH, 16);
  ctx.fillStyle = '#020617';
  ctx.shadowColor = 'transparent';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = color;
  ctx.stroke();

  // Digital number
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 24;
  ctx.font = '900 84px "Space Mono", "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(displaySec).padStart(2, '0'), centerX, centerY - 6);

  // "SEC" label
  ctx.shadowBlur = 0;
  ctx.font = '700 20px "Arial", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText('SECONDS', centerX, centerY + 52);

  ctx.restore();
}

function drawLoadingBarTimer(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  seconds: number,
  theme: QuizThemeConfig
) {
  ctx.save();

  const maxSeconds = theme.timerDuration || 10;
  const currentSec = Math.max(0, Math.min(maxSeconds, seconds));
  const progress = maxSeconds > 0 ? currentSec / maxSeconds : 0;

  const centerX = 1585;
  const centerY = 620;
  const barW = 260;
  const barH = 46;
  const color = getTimerHandColor(theme);

  // Time label above bar
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 40px "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.ceil(currentSec)}s`, centerX, centerY - barH / 2 - 36);

  // Track (background)
  roundRectPath(ctx, centerX - barW / 2, centerY - barH / 2, barW, barH, barH / 2);
  ctx.fillStyle = '#1e293b';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 6;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.stroke();

  // Fill (progress) - shrinks from full to empty as time runs out
  ctx.shadowColor = 'transparent';
  const fillW = Math.max(barH, barW * progress);
  roundRectPath(ctx, centerX - barW / 2, centerY - barH / 2, fillW, barH, barH / 2);
  const fillGrad = ctx.createLinearGradient(centerX - barW / 2, 0, centerX - barW / 2 + fillW, 0);
  fillGrad.addColorStop(0, color);
  fillGrad.addColorStop(1, color + 'cc');
  ctx.fillStyle = fillGrad;
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.fill();

  ctx.restore();
}

function drawAnalogClockTimer(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  seconds: number,
  theme: QuizThemeConfig
) {
  ctx.save();

  const maxSeconds = theme.timerDuration || 10;
  const currentSec = Math.max(0, Math.min(maxSeconds, seconds));

  // Position at Right Side Panel (X: 1585, Y: 620)
  const centerX = 1585;
  const centerY = 620;
  const radius = 150;

  // Outer Metallic Bezel Rim
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius + 18, 0, Math.PI * 2);
  const bezelGrad = ctx.createLinearGradient(centerX - radius, centerY - radius, centerX + radius, centerY + radius);
  bezelGrad.addColorStop(0, '#ffffff');
  bezelGrad.addColorStop(0.5, '#475569');
  bezelGrad.addColorStop(1, '#0f172a');
  ctx.fillStyle = bezelGrad;
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 10;
  ctx.fill();

  // Dark Inner Clock Face
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  const faceGrad = ctx.createRadialGradient(centerX, centerY, 10, centerX, centerY, radius);
  faceGrad.addColorStop(0, '#1e293b');
  faceGrad.addColorStop(1, '#020617');
  ctx.fillStyle = faceGrad;
  ctx.shadowColor = 'transparent';
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#3b82f6';
  ctx.stroke();

  // 10 Second Ticks around perimeter
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 5;
  for (let i = 0; i < maxSeconds; i++) {
    const angle = (i / maxSeconds) * 2 * Math.PI - Math.PI / 2;
    const innerR = radius - 26;
    const outerR = radius - 8;
    const x1 = centerX + Math.cos(angle) * innerR;
    const y1 = centerY + Math.sin(angle) * innerR;
    const x2 = centerX + Math.cos(angle) * outerR;
    const y2 = centerY + Math.sin(angle) * outerR;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // Top "10s" indicator label
  ctx.fillStyle = '#60a5fa';
  ctx.font = '900 24px "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('10s', centerX, centerY - radius + 40);

  // Single Clock Needle / Hand (pointing clockwise for 10 seconds)
  const handAngle = ((maxSeconds - currentSec) / maxSeconds) * 2 * Math.PI - Math.PI / 2;
  const handLength = radius - 30;

  let handColor = '#10b981'; // Green default
  if (theme.timerColor === 'red') handColor = '#ef4444';
  if (theme.timerColor === 'cyan') handColor = '#06b6d4';
  if (theme.timerColor === 'yellow') handColor = '#f59e0b';

  ctx.save();
  ctx.strokeStyle = handColor;
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  ctx.shadowColor = handColor;
  ctx.shadowBlur = 22;

  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  const handX = centerX + Math.cos(handAngle) * handLength;
  const handY = centerY + Math.sin(handAngle) * handLength;
  ctx.lineTo(handX, handY);
  ctx.stroke();
  ctx.restore();

  // Center Knob Cap
  ctx.beginPath();
  ctx.arc(centerX, centerY, 16, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#000000';
  ctx.stroke();

  ctx.restore();
}

// Helper utility functions
function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function getFontFamilyString(family: QuizThemeConfig['fontFamily']): string {
  switch (family) {
    case 'impact':
      return '"Anton", "Arial Black", Impact, sans-serif';
    case 'display':
      return '"Bebas Neue", Impact, sans-serif';
    case 'serif':
      return '"Playfair Display", Georgia, "Times New Roman", serif';
    case 'mono':
      return '"Space Mono", "Courier New", Courier, monospace';
    case 'sans':
    default:
      return '"Poppins", system-ui, sans-serif';
  }
}

function drawAutoFitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  leftX: number,
  centerX: number,
  centerY: number,
  maxWidth: number,
  maxHeight: number,
  baseFontSize: number,
  fontFam: string,
  color: string,
  isTyping: boolean = false,
  align: 'left' | 'center' = 'left'
) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';

  let fontSize = baseFontSize;
  const minFontSize = 24;
  let lines: string[] = [];
  let lineHeight = Math.round(fontSize * 1.22);

  const cursor = isTyping ? '▌' : '';
  const textWithCursor = text ? `${text}${cursor}` : cursor;

  if (!textWithCursor) {
    ctx.restore();
    return;
  }

  // Iteratively reduce font size until text cleanly fits inside maxWidth & maxHeight
  while (fontSize >= minFontSize) {
    ctx.font = `bold ${fontSize}px ${fontFam}`;
    lineHeight = Math.round(fontSize * 1.22);
    lines = calculateWrappedLines(ctx, textWithCursor, maxWidth);

    const totalHeight = (lines.length - 1) * lineHeight + fontSize;
    if (totalHeight <= maxHeight) {
      break;
    }
    fontSize -= 2;
  }

  ctx.font = `bold ${fontSize}px ${fontFam}`;
  lineHeight = Math.round(fontSize * 1.22);

  // Subtle contrast drop shadow for crystal-clear readability
  ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;

  const startY = centerY - ((lines.length - 1) * lineHeight) / 2;
  const renderX = align === 'left' ? leftX : centerX;

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], renderX, startY + i * lineHeight);
  }

  ctx.restore();
}

function calculateWrappedLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  if (!text) return [''];
  const words = text.split(' ');
  if (words.length === 0) return [''];

  const lines: string[] = [];
  let currentLine = '';

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth) {
      if (currentLine) {
        lines.push(currentLine);
        if (ctx.measureText(word).width > maxWidth) {
          // Break overly long unbroken word
          let partial = '';
          for (const char of word) {
            if (ctx.measureText(partial + char).width > maxWidth) {
              lines.push(partial);
              partial = char;
            } else {
              partial += char;
            }
          }
          currentLine = partial;
        } else {
          currentLine = word;
        }
      } else {
        // First single word exceeds line
        let partial = '';
        for (const char of word) {
          if (ctx.measureText(partial + char).width > maxWidth) {
            lines.push(partial);
            partial = char;
          } else {
            partial += char;
          }
        }
        currentLine = partial;
      }
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [''];
}

function lightenColor(color: string, percent: number): string {
  if (color.startsWith('#')) {
    let num = parseInt(color.slice(1), 16);
    let amt = Math.round(2.55 * percent);
    let R = (num >> 16) + amt;
    let G = ((num >> 8) & 0x00ff) + amt;
    let B = (num & 0x0000ff) + amt;
    return `#${(
      0x1000000 +
      (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
      (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
      (B < 255 ? (B < 1 ? 0 : B) : 255)
    )
      .toString(16)
      .slice(1)}`;
  }
  return color;
}

function darkenColor(color: string, percent: number): string {
  if (color.startsWith('#')) {
    let num = parseInt(color.slice(1), 16);
    let amt = Math.round(2.55 * percent);
    let R = (num >> 16) - amt;
    let G = ((num >> 8) & 0x00ff) - amt;
    let B = (num & 0x0000ff) - amt;
    return `#${(
      0x1000000 +
      (R > 0 ? (R > 255 ? 255 : R) : 0) * 0x10000 +
      (G > 0 ? (G > 255 ? 255 : G) : 0) * 0x100 +
      (B > 0 ? (B > 255 ? 255 : B) : 0)
    )
      .toString(16)
      .slice(1)}`;
  }
  return color;
}

function drawIntroCard(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  introOutro?: IntroOutroConfig,
  theme?: QuizThemeConfig,
  videoEl?: HTMLVideoElement | null,
  imgEl?: HTMLImageElement | null
) {
  // If uploaded video element is ready and playing, draw directly across canvas
  if (videoEl && videoEl.readyState >= 2) {
    try {
      ctx.drawImage(videoEl, 0, 0, w, h);
      return;
    } catch {
      // fallback to styled card
    }
  }

  // If uploaded image element is loaded, draw it
  if (imgEl && imgEl.complete && imgEl.naturalWidth > 0) {
    try {
      ctx.drawImage(imgEl, 0, 0, w, h);
      return;
    } catch {
      // fallback to styled card
    }
  }

  ctx.save();
  const cardW = 1400;
  const cardH = 600;
  const cardX = (w - cardW) / 2;
  const cardY = (h - cardH) / 2;

  // Outer Glowing Border
  roundRectPath(ctx, cardX - 10, cardY - 10, cardW + 20, cardH + 20, 50);
  ctx.fillStyle = '#4f46e5';
  ctx.shadowColor = '#6366f1';
  ctx.shadowBlur = 40;
  ctx.fill();

  // Main Card Body
  roundRectPath(ctx, cardX, cardY, cardW, cardH, 40);
  const grad = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
  grad.addColorStop(0, '#1e1b4b');
  grad.addColorStop(1, '#0f172a');
  ctx.fillStyle = grad;
  ctx.shadowColor = 'transparent';
  ctx.fill();

  // Intro Title
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 72px "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const titleText = introOutro?.introTitle || 'WELCOME TO THE QUIZ SHOW!';
  ctx.fillText(titleText, w / 2, h / 2 - 40);

  // Subtitle
  ctx.fillStyle = '#818cf8';
  ctx.font = 'bold 36px sans-serif';
  ctx.fillText(introOutro?.introSubtitle || '⚡ GET READY TO TEST YOUR KNOWLEDGE ⚡', w / 2, h / 2 + 60);

  ctx.restore();
}

function drawOutroCard(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  introOutro?: IntroOutroConfig,
  theme?: QuizThemeConfig,
  videoEl?: HTMLVideoElement | null,
  imgEl?: HTMLImageElement | null
) {
  // If uploaded video element is ready and playing, draw directly across canvas
  if (videoEl && videoEl.readyState >= 2) {
    try {
      ctx.drawImage(videoEl, 0, 0, w, h);
      return;
    } catch {
      // fallback to styled card
    }
  }

  // If uploaded image element is loaded, draw it
  if (imgEl && imgEl.complete && imgEl.naturalWidth > 0) {
    try {
      ctx.drawImage(imgEl, 0, 0, w, h);
      return;
    } catch {
      // fallback to styled card
    }
  }

  ctx.save();
  const cardW = 1400;
  const cardH = 600;
  const cardX = (w - cardW) / 2;
  const cardY = (h - cardH) / 2;

  // Outer Glowing Border
  roundRectPath(ctx, cardX - 10, cardY - 10, cardW + 20, cardH + 20, 50);
  ctx.fillStyle = '#9333ea';
  ctx.shadowColor = '#a855f7';
  ctx.shadowBlur = 40;
  ctx.fill();

  // Main Card Body
  roundRectPath(ctx, cardX, cardY, cardW, cardH, 40);
  const grad = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
  grad.addColorStop(0, '#3b0764');
  grad.addColorStop(1, '#0f172a');
  ctx.fillStyle = grad;
  ctx.shadowColor = 'transparent';
  ctx.fill();

  // Outro Title
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 72px "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const titleText = introOutro?.outroTitle || 'THANKS FOR PLAYING!';
  ctx.fillText(titleText, w / 2, h / 2 - 40);

  // Subtitle
  ctx.fillStyle = '#c084fc';
  ctx.font = 'bold 36px sans-serif';
  ctx.fillText(introOutro?.outroCallToAction || '🔔 LIKE, SHARE & SUBSCRIBE FOR MORE QUIZZES! 🔔', w / 2, h / 2 + 60);

  ctx.restore();
}



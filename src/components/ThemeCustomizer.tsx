import React from 'react';
import { Palette, Type, Clock, User, Sparkles, Upload, Image as ImageIcon } from 'lucide-react';
import { QuizThemeConfig, FontFamily, FontSize, TimerColor, TimerPosition } from '../types';
import { PRESET_THEMES } from '../data/defaults';

interface ThemeCustomizerProps {
  theme: QuizThemeConfig;
  onChange: (theme: QuizThemeConfig) => void;
}

export const ThemeCustomizer: React.FC<ThemeCustomizerProps> = ({ theme, onChange }) => {
  const updateProp = <K extends keyof QuizThemeConfig>(key: K, value: QuizThemeConfig[K]) => {
    onChange({ ...theme, [key]: value });
  };

  const handleMascotFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (evt.target?.result) {
          onChange({
            ...theme,
            mascotType: 'custom',
            customMascotUrl: evt.target.result as string,
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="bg-[#121217] border border-white/5 rounded-2xl p-5 space-y-6 text-white shadow-2xl overflow-y-auto max-h-[580px]">
      {/* Preset Themes Quick Selector */}
      <div>
        <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest block mb-2 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          Canvas Aesthetics Presets
        </label>
        <div className="grid grid-cols-2 gap-2">
          {PRESET_THEMES.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onChange({ ...theme, ...preset.theme })}
              className="px-3 py-2 rounded-xl bg-[#0a0a0c] border border-white/5 hover:border-indigo-500/50 text-xs font-bold text-white/80 hover:text-white transition text-left flex items-center gap-2"
            >
              <div
                className="w-3.5 h-3.5 rounded-md border border-white/20 shadow-sm"
                style={{ backgroundColor: preset.theme.questionBoxColor || '#4f46e5' }}
              />
              <span className="truncate text-xs font-medium">{preset.name}</span>
            </button>
          ))}
        </div>
      </div>

      <hr className="border-white/5" />

      {/* Colors Section */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
          <Palette className="w-4 h-4" /> Visual Colors
        </h3>

        <div className="grid grid-cols-2 gap-3 text-xs">
          {/* Canvas Background */}
          <div>
            <label className="text-white/40 block mb-1 text-[10px] font-bold uppercase tracking-wider">Canvas Background</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={theme.canvasBg.startsWith('#') ? theme.canvasBg : '#0a0a0c'}
                onChange={e => updateProp('canvasBg', e.target.value)}
                className="w-8 h-8 rounded-lg bg-transparent border border-white/10 cursor-pointer"
              />
              <select
                value={theme.bgPattern}
                onChange={e => updateProp('bgPattern', e.target.value as any)}
                className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#0a0a0c] border border-white/10 text-white text-xs outline-none focus:border-indigo-500"
              >
                <option value="waves">3D Wave Lines</option>
                <option value="grid">Cyber Grid</option>
                <option value="solid">Solid Color</option>
              </select>
            </div>
          </div>

          {/* Question Box Color */}
          <div>
            <label className="text-white/40 block mb-1 text-[10px] font-bold uppercase tracking-wider">Question Box Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={theme.questionBoxColor}
                onChange={e => updateProp('questionBoxColor', e.target.value)}
                className="w-8 h-8 rounded-lg bg-transparent border border-white/10 cursor-pointer"
              />
              <span className="text-white/70 font-mono text-[11px] uppercase font-bold">
                {theme.questionBoxColor}
              </span>
            </div>
          </div>

          {/* Option Boxes Color */}
          <div>
            <label className="text-white/40 block mb-1 text-[10px] font-bold uppercase tracking-wider">Option Boxes Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={theme.optionBoxColor}
                onChange={e => updateProp('optionBoxColor', e.target.value)}
                className="w-8 h-8 rounded-lg bg-transparent border border-white/10 cursor-pointer"
              />
              <span className="text-white/70 font-mono text-[11px] uppercase font-bold">
                {theme.optionBoxColor}
              </span>
            </div>
          </div>

          {/* Option Badge Circle Color */}
          <div>
            <label className="text-white/40 block mb-1 text-[10px] font-bold uppercase tracking-wider">Option Pill Badge</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={theme.optionBadgeColor}
                onChange={e => updateProp('optionBadgeColor', e.target.value)}
                className="w-8 h-8 rounded-lg bg-transparent border border-white/10 cursor-pointer"
              />
              <span className="text-white/70 font-mono text-[11px] uppercase font-bold">
                {theme.optionBadgeColor}
              </span>
            </div>
          </div>

          {/* Question Text Color */}
          <div>
            <label className="text-white/40 block mb-1 text-[10px] font-bold uppercase tracking-wider">Question Text Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={theme.questionTextColor || '#ffffff'}
                onChange={e => updateProp('questionTextColor', e.target.value)}
                className="w-8 h-8 rounded-lg bg-transparent border border-white/10 cursor-pointer"
              />
              <span className="text-white/70 font-mono text-[11px] uppercase font-bold">
                {theme.questionTextColor || '#ffffff'}
              </span>
            </div>
          </div>

          {/* Option Text Color */}
          <div>
            <label className="text-white/40 block mb-1 text-[10px] font-bold uppercase tracking-wider">Option Text Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={theme.optionTextColor || '#000000'}
                onChange={e => updateProp('optionTextColor', e.target.value)}
                className="w-8 h-8 rounded-lg bg-transparent border border-white/10 cursor-pointer"
              />
              <span className="text-white/70 font-mono text-[11px] uppercase font-bold">
                {theme.optionTextColor || '#000000'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <hr className="border-white/5" />

      {/* Typography Section */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
          <Type className="w-4 h-4" /> Typography & Typewriter Animation
        </h3>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <label className="text-white/40 block mb-1 text-[10px] font-bold uppercase tracking-wider">Font Family</label>
            <select
              value={theme.fontFamily}
              onChange={e => updateProp('fontFamily', e.target.value as FontFamily)}
              className="w-full px-3 py-2 rounded-xl bg-[#0a0a0c] border border-white/10 text-white outline-none focus:border-indigo-500 font-medium"
            >
              <option value="impact">Impact Display (Bold)</option>
              <option value="sans">Modern Sans</option>
              <option value="serif">Editorial Serif</option>
              <option value="mono">Retro Mono</option>
            </select>
          </div>

          <div>
            <label className="text-white/40 block mb-1 text-[10px] font-bold uppercase tracking-wider">Font Size</label>
            <select
              value={theme.fontSize}
              onChange={e => updateProp('fontSize', e.target.value as FontSize)}
              className="w-full px-3 py-2 rounded-xl bg-[#0a0a0c] border border-white/10 text-white outline-none focus:border-indigo-500 font-medium"
            >
              <option value="sm">Small (52px)</option>
              <option value="64px">64px Font Size</option>
              <option value="70px">70px Font Size</option>
              <option value="md">Medium (68px)</option>
              <option value="lg">Large (74px)</option>
              <option value="xl">Extra Large (80px)</option>
            </select>
          </div>
        </div>

        {/* Typewriter Animation Settings */}
        <div className="p-3 rounded-xl bg-[#0a0a0c] border border-white/5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-white block">Question Writing Animation</span>
              <span className="text-[10px] text-white/40">Smooth progressive writing animation starting from the left</span>
            </div>
            <input
              type="checkbox"
              checked={theme.enableTypewriter !== false}
              onChange={e => updateProp('enableTypewriter', e.target.checked)}
              className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-white/5">
            <span className="text-[10px] font-bold uppercase text-white/50">Question Alignment</span>
            <div className="flex gap-1.5">
              {[
                { id: 'left', label: 'Left (Standard)' },
                { id: 'center', label: 'Centered' },
              ].map((al) => (
                <button
                  key={al.id}
                  type="button"
                  onClick={() => updateProp('questionAlign', al.id as any)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition ${
                    (theme.questionAlign || 'left') === al.id
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {al.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <hr className="border-white/5" />

      {/* Correct Option Reveal & Celebration Emoji */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" /> Correct Answer Reveal & Emoji
          </h3>
          <input
            type="checkbox"
            checked={theme.enableRevealEmoji !== false}
            onChange={e => updateProp('enableRevealEmoji', e.target.checked)}
            className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
          />
        </div>

        {theme.enableRevealEmoji !== false && (
          <div className="p-3 rounded-xl bg-[#0a0a0c] border border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white block">Celebration Emoji on Answer Reveal</span>
                <span className="text-[10px] text-white/40">Emoji appears in front of correct answer capsule</span>
              </div>
              <span className="text-2xl drop-shadow">{theme.correctRevealEmoji || '🎉'}</span>
            </div>

            {/* Quick Emoji Presets */}
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/50 block mb-1.5">
                Choose Celebration Emoji
              </span>
              <div className="grid grid-cols-5 gap-1.5">
                {[
                  { emoji: '🎉', label: 'Party' },
                  { emoji: '🥳', label: 'Celebrate' },
                  { emoji: '🎯', label: 'Target' },
                  { emoji: '👏', label: 'Clap' },
                  { emoji: '🏆', label: 'Trophy' },
                  { emoji: '✨', label: 'Sparkle' },
                  { emoji: '🔥', label: 'Fire' },
                  { emoji: '💡', label: 'Genius' },
                  { emoji: '✅', label: 'Check' },
                  { emoji: '🌟', label: 'Star' },
                ].map((item) => (
                  <button
                    key={item.emoji}
                    type="button"
                    onClick={() => updateProp('correctRevealEmoji', item.emoji)}
                    className={`py-1.5 px-1 rounded-lg border text-center transition flex flex-col items-center justify-center gap-0.5 ${
                      (theme.correctRevealEmoji || '🎉') === item.emoji
                        ? 'bg-indigo-600/30 border-indigo-500 text-white shadow-sm'
                        : 'bg-black/30 border-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span className="text-lg">{item.emoji}</span>
                    <span className="text-[8px] text-white/40 uppercase font-bold">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Emoji Input */}
            <div className="pt-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/50 block mb-1">
                Or Type Any Custom Emoji
              </label>
              <input
                type="text"
                maxLength={4}
                value={theme.correctRevealEmoji || '🎉'}
                onChange={e => updateProp('correctRevealEmoji', e.target.value)}
                placeholder="🎉"
                className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white outline-none focus:border-indigo-500 font-bold text-center text-lg"
              />
            </div>
          </div>
        )}

        {/* Reveal Highlight Colors */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-white/40 block mb-1 text-[10px] font-bold uppercase tracking-wider">Correct Box Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={theme.correctHighlightColor || '#fbbf24'}
                onChange={e => updateProp('correctHighlightColor', e.target.value)}
                className="w-8 h-8 rounded-lg bg-transparent border border-white/10 cursor-pointer"
              />
              <span className="text-white/70 font-mono text-[11px] uppercase font-bold">
                {theme.correctHighlightColor || '#fbbf24'}
              </span>
            </div>
          </div>

          <div>
            <label className="text-white/40 block mb-1 text-[10px] font-bold uppercase tracking-wider">Correct Pill Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={theme.correctBadgeColor || '#eab308'}
                onChange={e => updateProp('correctBadgeColor', e.target.value)}
                className="w-8 h-8 rounded-lg bg-transparent border border-white/10 cursor-pointer"
              />
              <span className="text-white/70 font-mono text-[11px] uppercase font-bold">
                {theme.correctBadgeColor || '#eab308'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <hr className="border-white/5" />

      {/* Digital 7-Segment Timer Settings */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
          <Clock className="w-4 h-4" /> Digital LED Timer
        </h3>

        <div className="grid grid-cols-4 gap-2">
          {/* LED Glow Colors */}
          {(['green', 'red', 'cyan', 'yellow'] as TimerColor[]).map((col) => (
            <button
              key={col}
              type="button"
              onClick={() => updateProp('timerColor', col)}
              className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-wider border transition flex items-center justify-center gap-1 ${
                theme.timerColor === col
                  ? 'bg-indigo-600/20 text-white border-indigo-500 shadow-sm'
                  : 'bg-[#0a0a0c] text-white/40 border-white/5 hover:bg-white/5'
              }`}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor:
                    col === 'green'
                      ? '#10b981'
                      : col === 'red'
                      ? '#ef4444'
                      : col === 'cyan'
                      ? '#06b6d4'
                      : '#f59e0b',
                }}
              />
              {col}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <label className="text-white/40 block mb-1 text-[10px] font-bold uppercase tracking-wider">Timer Position</label>
            <select
              value={theme.timerPosition}
              onChange={e => updateProp('timerPosition', e.target.value as TimerPosition)}
              className="w-full px-3 py-2 rounded-xl bg-[#0a0a0c] border border-white/10 text-white outline-none focus:border-indigo-500 font-medium"
            >
              <option value="bottom-right">Bottom Right</option>
              <option value="bottom-center">Bottom Center</option>
              <option value="bottom-left">Bottom Left</option>
              <option value="top-right">Top Right</option>
            </select>
          </div>

          <div>
            <label className="text-white/40 block mb-1 text-[10px] font-bold uppercase tracking-wider">Duration (Seconds)</label>
            <input
              type="number"
              min={3}
              max={15}
              value={theme.timerDuration}
              onChange={e => updateProp('timerDuration', Math.max(3, Number(e.target.value)))}
              className="w-full px-3 py-2 rounded-xl bg-[#0a0a0c] border border-white/10 text-white outline-none focus:border-indigo-500 font-medium"
            />
          </div>
        </div>
      </div>

      <hr className="border-white/5" />

      {/* 3D Mascot Character */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
          <User className="w-4 h-4" /> 3D Mascot Graphic
        </h3>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-black text-lg">
            🤔
          </div>

          <div className="flex-1 space-y-2">
            <span className="text-xs text-white/70 block font-medium">
              Trivia Mascot Avatar Icon
            </span>
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1c1c24] hover:bg-white/10 text-xs font-bold text-white cursor-pointer transition border border-white/10">
              <Upload className="w-3.5 h-3.5 text-indigo-400" />
              Upload Mascot Graphic
              <input
                type="file"
                accept="image/*"
                onChange={handleMascotFileUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

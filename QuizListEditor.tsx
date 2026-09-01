import React, { useState, useMemo } from 'react';
import { Plus, Trash2, Edit3, Check, FileText, Layers, CheckCircle, Clipboard, RefreshCw, Sparkles } from 'lucide-react';
import { QuizItem, OptionLetter } from '../types';
import { parseBulkQuizText, formatQuizToBulkText, cleanQuestionPrefix } from '../utils/quizParser';

interface QuizListEditorProps {
  questions: QuizItem[];
  onChange: (questions: QuizItem[]) => void;
  currentIndex: number;
  onSelectIndex: (index: number) => void;
}

export const QuizListEditor: React.FC<QuizListEditorProps> = ({
  questions,
  onChange,
  currentIndex,
  onSelectIndex,
}) => {
  const [activeTab, setActiveTab] = useState<'list' | 'bulk'>('list');
  const [bulkText, setBulkText] = useState(() => formatQuizToBulkText(questions));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  // Live parsed questions count
  const detectedQuestions = useMemo(() => {
    return parseBulkQuizText(bulkText);
  }, [bulkText]);

  const handleGenerateQuizFromText = (mode: 'replace' | 'append' = 'replace') => {
    setParseError(null);
    const parsed = parseBulkQuizText(bulkText);
    if (parsed.length > 0) {
      const updated = mode === 'append' ? [...questions, ...parsed] : parsed;
      onChange(updated);
      setActiveTab('list');
      onSelectIndex(0);
      setSuccessMessage(
        `Successfully loaded ${parsed.length} questions! All ${updated.length} questions are ready for video export.`
      );
      setTimeout(() => setSuccessMessage(null), 5000);
    } else {
      setParseError(
        'Could not detect valid questions from text. Please ensure questions have options (A, B, C, D) and an Answer line.'
      );
    }
  };

  const handleAddQuestion = () => {
    const newItem: QuizItem = {
      id: `custom-${Date.now()}`,
      question: 'New Quiz Question?',
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      answer: 'A',
    };
    const updated = [...questions, newItem];
    onChange(updated);
    setEditingId(newItem.id);
    onSelectIndex(updated.length - 1);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = questions.filter(q => q.id !== id);
    onChange(updated);
    if (currentIndex >= updated.length) {
      onSelectIndex(Math.max(0, updated.length - 1));
    }
  };

  const handleUpdateItem = (updatedItem: QuizItem) => {
    const sanitized = {
      ...updatedItem,
      question: cleanQuestionPrefix(updatedItem.question),
    };
    const updated = questions.map(q => (q.id === updatedItem.id ? sanitized : q));
    onChange(updated);
  };

  const handlePasteClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setBulkText(text);
        }
      }
    } catch {
      // Clipboard read fallback
    }
  };

  const sampleRawTemplate = `1. What is the capital of France?
A. London
B. Paris
C. Rome
D. Berlin
Answer: B

2. Which planet is known as the Red Planet?
A. Venus
B. Mars
C. Jupiter
D. Saturn
Answer: B

3. In welcher Stadt steht das Brandenburger Tor?
A. Hamburg
B. München
C. Berlin
D. Köln
Richtige Antwort: C

4. Which gas do plants absorb from the atmosphere?
A. Oxygen
B. Carbon Dioxide
C. Nitrogen
D. Hydrogen
Answer: B`;

  return (
    <div className="bg-[#121217] border border-white/5 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-full text-white">
      {/* Editor Header Tabs */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#0a0a0c]/80">
        <div className="flex items-center gap-1.5 p-1 bg-[#121217] rounded-xl border border-white/5 w-full">
          <button
            onClick={() => setActiveTab('list')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition flex items-center justify-center gap-1.5 ${
              activeTab === 'list'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-white/40 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Quiz List ({questions.length})
          </button>
          <button
            onClick={() => setActiveTab('bulk')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition flex items-center justify-center gap-1.5 ${
              activeTab === 'bulk'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-white/40 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Bulk Paste Quiz
            {detectedQuestions.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/30 text-emerald-300 text-[10px] font-mono">
                {detectedQuestions.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successMessage && (
        <div className="mx-4 mt-3 px-3.5 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Content Body */}
      {activeTab === 'list' ? (
        <div className="p-4 overflow-y-auto max-h-[460px] space-y-3 flex-1">
          {questions.map((q, idx) => {
            const isSelected = idx === currentIndex;
            const isEditing = editingId === q.id;

            return (
              <div
                key={q.id}
                onClick={() => onSelectIndex(idx)}
                className={`p-3.5 rounded-xl border transition cursor-pointer ${
                  isSelected
                    ? 'bg-[#1c1c24] border-indigo-500/60 shadow-lg shadow-indigo-600/10'
                    : 'bg-[#0a0a0c]/60 border-white/5 hover:border-white/20'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-6 h-6 rounded-lg text-[10px] font-black flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white/10 text-white/50'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span className="text-xs font-bold text-white line-clamp-1">
                      {q.question}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(isEditing ? null : q.id);
                      }}
                      className="p-1 rounded text-white/40 hover:text-indigo-400 hover:bg-white/5"
                      title="Edit Question"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(q.id, e)}
                      className="p-1 rounded text-white/40 hover:text-rose-400 hover:bg-white/5"
                      title="Delete Question"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Expanded Inline Editor */}
                {isEditing ? (
                  <div
                    onClick={e => e.stopPropagation()}
                    className="mt-3 pt-3 border-t border-white/10 space-y-3 text-xs"
                  >
                    <div>
                      <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest block mb-1">
                        Question Text (Pure Question Only)
                      </label>
                      <input
                        type="text"
                        value={q.question}
                        onChange={e => handleUpdateItem({ ...q, question: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg bg-[#0a0a0c] border border-white/10 text-white font-medium focus:border-indigo-500 outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {(['A', 'B', 'C', 'D'] as OptionLetter[]).map((letter, oIdx) => (
                        <div key={letter} className="flex items-center gap-1.5">
                          <span
                            className={`w-5 h-5 rounded text-[10px] font-black flex items-center justify-center ${
                              q.answer === letter
                                ? 'bg-emerald-500 text-white'
                                : 'bg-white/10 text-white/50'
                            }`}
                          >
                            {letter}
                          </span>
                          <input
                            type="text"
                            value={q.options[oIdx]}
                            onChange={e => {
                              const newOpts = [...q.options] as [string, string, string, string];
                              newOpts[oIdx] = e.target.value;
                              handleUpdateItem({ ...q, options: newOpts });
                            }}
                            className="flex-1 px-2 py-1 rounded bg-[#0a0a0c] border border-white/10 text-white text-[11px] focus:border-indigo-500 outline-none"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Correct:</span>
                        {(['A', 'B', 'C', 'D'] as OptionLetter[]).map(letter => (
                          <button
                            key={letter}
                            type="button"
                            onClick={() => handleUpdateItem({ ...q, answer: letter })}
                            className={`px-2 py-0.5 rounded text-[11px] font-black transition ${
                              q.answer === letter
                                ? 'bg-emerald-500 text-white shadow-sm'
                                : 'bg-white/10 text-white/50 hover:text-white'
                            }`}
                          >
                            {letter}
                          </button>
                        ))}
                      </div>

                      <button
                        onClick={() => setEditingId(null)}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-bold text-[10px] uppercase tracking-wider flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" /> Done
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5 mt-2">
                    {q.options.map((opt, oIdx) => {
                      const letter = String.fromCharCode(65 + oIdx) as OptionLetter;
                      const isCorrect = q.answer === letter;
                      return (
                        <div
                          key={oIdx}
                          className={`px-2 py-1 rounded-lg text-[11px] flex items-center gap-1.5 truncate border ${
                            isCorrect
                              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-bold'
                              : 'bg-white/5 border-white/5 text-white/60'
                          }`}
                        >
                          <span className="font-black text-white/40">{letter}:</span>
                          <span className="truncate">{opt}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          <button
            onClick={handleAddQuestion}
            className="w-full py-2.5 border border-dashed border-white/10 hover:border-indigo-500/60 rounded-xl text-xs font-bold text-white/50 hover:text-indigo-400 transition flex items-center justify-center gap-2 uppercase tracking-wider"
          >
            <Plus className="w-4 h-4" /> Add Question
          </button>
        </div>
      ) : (
        /* Bulk Raw Text Area */
        <div className="p-4 space-y-3 flex-1 flex flex-col">
          {parseError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-bold leading-relaxed">
              {parseError}
            </div>
          )}

          {/* Quick Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-white/5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                Paste 40+ Questions Here
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                  detectedQuestions.length > 0
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                }`}
              >
                {detectedQuestions.length} Questions Detected
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePasteClipboard}
                className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 uppercase tracking-wider flex items-center gap-1 px-2 py-1 rounded bg-white/5 hover:bg-white/10"
                title="Paste from clipboard"
              >
                <Clipboard className="w-3 h-3" /> Paste
              </button>
              <button
                type="button"
                onClick={() => setBulkText(formatQuizToBulkText(questions))}
                className="text-[10px] font-bold text-white/50 hover:text-white uppercase tracking-wider flex items-center gap-1 px-2 py-1 rounded bg-white/5 hover:bg-white/10"
                title="Sync from current list"
              >
                <RefreshCw className="w-3 h-3" /> Sync List
              </button>
              <button
                type="button"
                onClick={() => setBulkText(sampleRawTemplate)}
                className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 uppercase tracking-wider px-2 py-1 rounded bg-white/5 hover:bg-white/10"
              >
                Sample
              </button>
              <button
                type="button"
                onClick={() => setBulkText('')}
                className="text-[10px] font-bold text-rose-400 hover:text-rose-300 uppercase tracking-wider px-2 py-1 rounded bg-white/5 hover:bg-white/10"
              >
                Clear
              </button>
            </div>
          </div>

          <textarea
            value={bulkText}
            onChange={e => setBulkText(e.target.value)}
            rows={12}
            className="w-full p-3.5 rounded-xl bg-black/40 border border-white/5 text-white/80 font-mono text-xs focus:outline-none focus:border-indigo-500/50 leading-relaxed resize-none flex-1"
            placeholder={`Paste 40+ questions in any format:

1. What is the capital of Germany?
A. Munich
B. Hamburg
C. Berlin
D. Frankfurt
Answer: C

(Supports English "Answer: B", German "Richtige Antwort: B", Excel sheets, CSV, etc.)`}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => handleGenerateQuizFromText('replace')}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-xs uppercase tracking-widest transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 active:scale-95 border border-indigo-400/30"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              Load All ({detectedQuestions.length || 0}) Questions
            </button>
            <button
              onClick={() => handleGenerateQuizFromText('append')}
              disabled={detectedQuestions.length === 0}
              className="w-full py-3 rounded-xl bg-[#1c1c24] hover:bg-white/10 text-white font-bold text-xs uppercase tracking-widest transition flex items-center justify-center gap-2 border border-white/10 disabled:opacity-40"
            >
              <Plus className="w-4 h-4 text-indigo-400" />
              Append to Existing ({questions.length})
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

import { QuizItem, OptionLetter } from '../types';

/**
 * Universal Robust Quiz Parser
 * Seamlessly parses bulk pasted quiz text from ChatGPT, DeepSeek, Excel, Google Sheets, CSV, JSON,
 * standard TV game show quiz formats, numbered lists, and multilingual formats (English, German,
 * Spanish, French, Italian, Dutch, Urdu/Hindi, Indonesian, Turkish, Polish, etc.).
 */
export function parseBulkQuizText(rawText: string): QuizItem[] {
  if (!rawText || !rawText.trim()) return [];

  const trimmed = rawText.trim();

  // -------------------------------------------------------------
  // STRATEGY 1: JSON Array Format
  // -------------------------------------------------------------
  if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
    try {
      const parsed = JSON.parse(trimmed);
      const list = Array.isArray(parsed) ? parsed : parsed.questions || parsed.quiz || [];
      if (Array.isArray(list) && list.length > 0) {
        const jsonItems: QuizItem[] = [];
        list.forEach((p, idx) => {
          if (p && (p.question || p.q || p.title)) {
            const qText = String(p.question || p.q || p.title || `Question ${idx + 1}`).trim();
            let opts: [string, string, string, string] = ['Option A', 'Option B', 'Option C', 'Option D'];

            if (Array.isArray(p.options) && p.options.length >= 2) {
              opts = [
                String(p.options[0] || 'Option A').trim(),
                String(p.options[1] || 'Option B').trim(),
                String(p.options[2] || 'Option C').trim(),
                String(p.options[3] || 'Option D').trim(),
              ];
            } else if (p.optionA || p.A || p.a) {
              opts = [
                String(p.optionA || p.A || p.a || 'Option A').trim(),
                String(p.optionB || p.B || p.b || 'Option B').trim(),
                String(p.optionC || p.C || p.c || 'Option C').trim(),
                String(p.optionD || p.D || p.d || 'Option D').trim(),
              ];
            }

            let ans: OptionLetter = 'A';
            const rawAns = String(p.answer || p.ans || p.correct || p.correctAnswer || p.richtigeAntwort || p.antwort || 'A').trim().toUpperCase();
            if (['A', 'B', 'C', 'D'].includes(rawAns)) {
              ans = rawAns as OptionLetter;
            } else if (['1', '2', '3', '4'].includes(rawAns)) {
              ans = (['A', 'B', 'C', 'D'][parseInt(rawAns, 10) - 1]) as OptionLetter;
            }

            jsonItems.push({
              id: `parsed-json-${Date.now()}-${idx + 1}`,
              question: cleanQuestionPrefix(qText),
              options: opts,
              answer: ans,
              explanation: p.explanation || p.expl || undefined,
            });
          }
        });

        if (jsonItems.length > 0) return jsonItems;
      }
    } catch {
      // Continue to next strategies if JSON parse fails
    }
  }

  // -------------------------------------------------------------
  // STRATEGY 2: TSV / Excel Spreadsheet Copy-Paste (Tab-Separated)
  // -------------------------------------------------------------
  const allLines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const tabLines = allLines.filter(l => l.split('\t').length >= 4);

  if (tabLines.length >= 2 && tabLines.length >= allLines.length * 0.5) {
    const tsvItems: QuizItem[] = [];
    tabLines.forEach((line, idx) => {
      // Skip header row if present
      if (idx === 0 && (line.toLowerCase().includes('question') && (line.toLowerCase().includes('option') || line.toLowerCase().includes('answer') || line.toLowerCase().includes('antwort')))) {
        return;
      }

      const cols = line.split('\t').map(c => c.trim().replace(/^["']|["']$/g, ''));
      let qText = '';
      let optA = '';
      let optB = '';
      let optC = '';
      let optD = '';
      let ansStr = '';

      if (cols.length >= 6 && /^\d+$/.test(cols[0])) {
        // [ID, Question, OptA, OptB, OptC, OptD, Ans?]
        qText = cols[1];
        optA = cols[2];
        optB = cols[3];
        optC = cols[4];
        optD = cols[5];
        ansStr = cols[6] || '';
      } else if (cols.length >= 5) {
        // [Question, OptA, OptB, OptC, OptD, Ans?]
        qText = cols[0];
        optA = cols[1];
        optB = cols[2];
        optC = cols[3];
        optD = cols[4];
        ansStr = cols[5] || '';
      }

      if (qText && (optA || optB)) {
        const resolvedAns = resolveAnswerLetter(ansStr, [optA, optB, optC, optD]);
        tsvItems.push({
          id: `parsed-tsv-${Date.now()}-${tsvItems.length + 1}`,
          question: cleanQuestionPrefix(qText),
          options: [optA || 'Option A', optB || 'Option B', optC || 'Option C', optD || 'Option D'],
          answer: resolvedAns,
        });
      }
    });

    if (tsvItems.length > 0) return tsvItems;
  }

  // -------------------------------------------------------------
  // STRATEGY 3: CSV Rows Copy-Paste
  // -------------------------------------------------------------
  const csvLines = allLines.filter(l => l.includes(',') && !l.startsWith('#'));
  if (csvLines.length >= 2 && csvLines.length >= allLines.length * 0.6) {
    const csvItems: QuizItem[] = [];
    csvLines.forEach((line, idx) => {
      if (idx === 0 && (line.toLowerCase().includes('question') && (line.toLowerCase().includes('option') || line.toLowerCase().includes('answer') || line.toLowerCase().includes('antwort')))) {
        return;
      }
      const matches = line.match(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/g);
      if (matches && matches.length >= 5) {
        const cols = matches.map(m => m.replace(/^,/, '').trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
        let qText = '';
        let optA = '';
        let optB = '';
        let optC = '';
        let optD = '';
        let ansStr = '';

        if (cols.length >= 6 && /^\d+$/.test(cols[0])) {
          qText = cols[1];
          optA = cols[2];
          optB = cols[3];
          optC = cols[4];
          optD = cols[5];
          ansStr = cols[6] || '';
        } else if (cols.length >= 5) {
          qText = cols[0];
          optA = cols[1];
          optB = cols[2];
          optC = cols[3];
          optD = cols[4];
          ansStr = cols[5] || '';
        }

        if (qText && (optA || optB)) {
          const resolvedAns = resolveAnswerLetter(ansStr, [optA, optB, optC, optD]);
          csvItems.push({
            id: `parsed-csv-${Date.now()}-${csvItems.length + 1}`,
            question: cleanQuestionPrefix(qText),
            options: [optA || 'Option A', optB || 'Option B', optC || 'Option C', optD || 'Option D'],
            answer: resolvedAns,
          });
        }
      }
    });

    if (csvItems.length > 0) return csvItems;
  }

  // -------------------------------------------------------------
  // STRATEGY 4: Universal Multi-Block & Line-by-Line Parser
  // Handles all numbered, unnumbered, Aiken, multilingual, and custom quiz styles
  // -------------------------------------------------------------
  const items: QuizItem[] = [];

  let currentQuestion = '';
  let currentOptions: { letter: OptionLetter; text: string }[] = [];
  let currentAnswer: OptionLetter | null = null;
  let currentExplanation = '';

  const finalizeItem = () => {
    const cleanedQ = cleanQuestionPrefix(currentQuestion);
    if (cleanedQ && (currentOptions.length >= 2 || currentAnswer !== null)) {
      // Find or build 4 options
      let optA = currentOptions.find(o => o.letter === 'A')?.text || currentOptions[0]?.text || 'Option A';
      let optB = currentOptions.find(o => o.letter === 'B')?.text || currentOptions[1]?.text || 'Option B';
      let optC = currentOptions.find(o => o.letter === 'C')?.text || currentOptions[2]?.text || 'Option C';
      let optD = currentOptions.find(o => o.letter === 'D')?.text || currentOptions[3]?.text || 'Option D';

      // If only 2 or 3 options were given (e.g. True/False), ensure clean display
      if (currentOptions.length === 2 && !currentOptions.find(o => o.letter === 'C')) {
        optC = 'None of the above';
        optD = 'Both of the above';
      }

      let finalAnswer: OptionLetter = currentAnswer || 'A';
      if (!currentAnswer && currentOptions.length > 0) {
        finalAnswer = 'A';
      }

      items.push({
        id: `parsed-${Date.now()}-${items.length + 1}`,
        question: cleanedQ,
        options: [cleanOptionText(optA), cleanOptionText(optB), cleanOptionText(optC), cleanOptionText(optD)],
        answer: finalAnswer,
        explanation: currentExplanation || undefined,
      });
    }

    currentQuestion = '';
    currentOptions = [];
    currentAnswer = null;
    currentExplanation = '';
  };

  // Multilingual question number regex (English, German "Frage", Spanish "Pregunta", French "Question", Italian "Domanda", etc.)
  const questionNumberRegex = /^(?:(?:\d{1,3}[\.\)\:\-\/]\s*)|(?:(?:Q(?:uestion)?|Frage|Pregunta|Domanda|Vraag|Pytanie|Sawal|Soru|Pertanyaan)\s*#?\d{1,3}[\.\:\-\)]?\s*)|(?:\#\d{1,3}[\.\:\s]+)|(?:\(\d{1,3}\)\s*)|(?:\[\d{1,3}\]\s*))/i;

  const optionRegex = /^[\(\[]?([A-D]|[1-4])[\.\)\]\:\-]\s*(.+)$/i;
  const bulletOptionRegex = /^[\-\*\•]\s*[\(\[]?([A-D])?[\.\)\]\:\-]?\s*(.+)$/i;

  // Multilingual Answer Regex covering "Richtige Antwort: B", "Antwort: B", "Answer: B", "Lösung: B", "Correct: B", "Respuesta: B", etc.
  const answerRegex = /^(?:Richtige\s*Antwort|Korrekte\s*Antwort|Antwort|Richtig|L[öo]sung|L[öo]sungen|Korrekt|Answer|Ans|Correct\s*Option|Correct\s*Answer|Correct|Right\s*Answer|Key|Jawab|Sahi\s*Jawab|Uttar|Jawaban|Jawaban\s*Benar|Resultado|Respuesta(?:\s*correcta)?|R[ée]ponse(?:\s*correcte)?|Risposta(?:\s*corretta)?|Juiste\s*antwoord|Odpowied[zź]|Do[gğ]ru\s*cevap|Cevap|ANSWER|ANS)[:\s\-\=\.]*[\(\[]?(?:Option\s*)?([A-D]|[1-4])?[\.\)\]]?\s*(.*)$/i;

  const inlineOptionsRegex = /(?:^|\s)(?:A[\.\)]|\(A\))\s+(.+?)\s+(?:B[\.\)]|\(B\))\s+(.+?)(?:\s+(?:C[\.\)]|\(C\))\s+(.+?))?(?:\s+(?:D[\.\)]|\(D\))\s+(.+?))?(?:\s+(?:(?:Richtige\s*Antwort|Antwort|Answer|Ans|Correct|L[öo]sung)[:\s]+([A-D])))?$/i;

  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i];

    // If the previous question already had its "Answer:" line recorded, it is
    // fully complete — close it out now before evaluating this new line. This
    // guarantees a fresh, empty state for every new question block, which is
    // what lets the digit-indicator guard above correctly recognize question
    // numbers 1-4 instead of mistaking them for options.
    if (currentAnswer !== null && currentQuestion) {
      finalizeItem();
    }

    // Check if line is an inline single-line question
    const inlineMatch = line.match(inlineOptionsRegex);
    if (inlineMatch) {
      if (currentQuestion) finalizeItem();

      const qPart = line.replace(inlineOptionsRegex, '').trim();
      const optA = (inlineMatch[1] || 'Option A').trim();
      const optB = (inlineMatch[2] || 'Option B').trim();
      const optC = (inlineMatch[3] || 'Option C').trim();
      const optD = (inlineMatch[4] || 'Option D').trim();
      const ansLetter = (inlineMatch[5] ? inlineMatch[5].toUpperCase() : 'A') as OptionLetter;

      items.push({
        id: `parsed-inline-${Date.now()}-${items.length + 1}`,
        question: cleanQuestionPrefix(qPart || `Question ${items.length + 1}`),
        options: [cleanOptionText(optA), cleanOptionText(optB), cleanOptionText(optC), cleanOptionText(optD)],
        answer: (['A', 'B', 'C', 'D'].includes(ansLetter) ? ansLetter : 'A') as OptionLetter,
      });
      continue;
    }

    // 1. Check Answer Line (e.g. "Richtige Antwort: B", "Answer: B", "Antwort: B", "Lösung: B")
    const answerMatch = line.match(answerRegex);
    if (answerMatch) {
      const matchVal = (answerMatch[1] || '').toUpperCase();
      if (['A', 'B', 'C', 'D'].includes(matchVal)) {
        currentAnswer = matchVal as OptionLetter;
      } else if (['1', '2', '3', '4'].includes(matchVal)) {
        const numToLetter: Record<string, OptionLetter> = { '1': 'A', '2': 'B', '3': 'C', '4': 'D' };
        currentAnswer = numToLetter[matchVal];
      } else {
        // Answer given as option text (e.g. "Richtige Antwort: Paris" or "Ans: Option B - London")
        const remaining = (answerMatch[2] || line).trim();
        const extractedLetter = extractLetterFromText(remaining);
        if (extractedLetter) {
          currentAnswer = extractedLetter;
        } else if (currentOptions.length > 0) {
          // Match text with existing options
          const matchedOpt = currentOptions.find(o =>
            remaining.toLowerCase().includes(o.text.toLowerCase()) ||
            o.text.toLowerCase().includes(remaining.toLowerCase())
          );
          if (matchedOpt) {
            currentAnswer = matchedOpt.letter;
          }
        }
      }

      if (answerMatch[2] && !currentExplanation) {
        // Strip a leading separator (e.g. "- explanation") and a single pair of
        // wrapping parentheses/brackets (e.g. "(Alpha is the first letter...)")
        // so the stored explanation is clean plain text for display + narration.
        let expl = answerMatch[2].replace(/^[\-\:\.]\s*/, '').trim();
        const wrapped = expl.match(/^[\(\[]([\s\S]*)[\)\]]$/);
        if (wrapped) expl = wrapped[1].trim();
        currentExplanation = expl;
      }
      continue;
    }

    // 2. Check Option Line (A. ..., (B) ..., 1. ..., etc.)
    const optionMatch = line.match(optionRegex);
    if (optionMatch) {
      const rawIndicator = optionMatch[1].toUpperCase();
      const isNumericIndicator = ['1', '2', '3', '4'].includes(rawIndicator);

      // Guard: a bare digit indicator ("1.", "2.", "3.", "4.") appearing at the very
      // start of a fresh block (no options collected yet AND no question title
      // accumulated yet) is a QUESTION NUMBER, not a numeric option label — numbered
      // quiz lists (1., 2., 3. ... 20.) would otherwise have questions #1-#4 wrongly
      // swallowed as options A-D, corrupting every question that follows them.
      const looksLikeFreshQuestionNumber = isNumericIndicator && currentOptions.length === 0 && !currentQuestion;

      if (!looksLikeFreshQuestionNumber) {
        let letter: OptionLetter = 'A';

        if (['A', 'B', 'C', 'D'].includes(rawIndicator)) {
          letter = rawIndicator as OptionLetter;
        } else if (isNumericIndicator) {
          const numToLetter: Record<string, OptionLetter> = { '1': 'A', '2': 'B', '3': 'C', '4': 'D' };
          letter = numToLetter[rawIndicator];
        }

        // If we see Option A again and already have options, it means a new question started without explicit answer!
        if (letter === 'A' && currentOptions.length >= 2 && currentQuestion) {
          finalizeItem();
        }

        const text = optionMatch[2].trim();
        currentOptions.push({ letter, text });
        continue;
      }
    }

    // 2b. Check Bulleted Option Line (- Option A, • Option B)
    const bulletMatch = line.match(bulletOptionRegex);
    if (bulletMatch && (currentQuestion || currentOptions.length > 0)) {
      const detectedLetter = (bulletMatch[1]?.toUpperCase() as OptionLetter) || (['A', 'B', 'C', 'D'][currentOptions.length] as OptionLetter) || 'D';
      const text = bulletMatch[2].trim();
      currentOptions.push({ letter: detectedLetter, text });
      continue;
    }

    // 3. Check if starting a new question
    const isNewQuestionNumber = questionNumberRegex.test(line);
    const hasExistingQuestionWithOptions = currentQuestion && (currentOptions.length > 0 || currentAnswer !== null);

    if (isNewQuestionNumber || hasExistingQuestionWithOptions) {
      if (hasExistingQuestionWithOptions) {
        finalizeItem();
      }
      currentQuestion = line;
      continue;
    }

    // 4. Accumulate question title if no options yet
    if (currentOptions.length === 0) {
      // Guard: Make sure we do NOT accumulate standalone answer lines like "Richtige Antwort: B"
      if (isStandaloneAnswerText(line)) {
        const ansLet = extractLetterFromText(line);
        if (ansLet) currentAnswer = ansLet;
        continue;
      }

      if (currentQuestion) {
        currentQuestion += ' ' + line;
      } else {
        currentQuestion = line;
      }
    }
  }

  // Finalize last question in the text
  if (currentQuestion && (currentOptions.length > 0 || currentAnswer !== null)) {
    finalizeItem();
  }

  return items;
}

/**
 * Checks if a line is a standalone answer declaration (e.g. "Richtige Antwort: B", "Antwort B", "Answer: C")
 */
function isStandaloneAnswerText(text: string): boolean {
  return /^(?:Richtige\s*Antwort|Korrekte\s*Antwort|Antwort|Richtig|L[öo]sung|L[öo]sungen|Korrekt|Answer|Ans|Correct\s*Option|Correct\s*Answer|Correct|Right\s*Answer|Key|Jawab|Uttar|Jawaban|Resultado|Respuesta|R[ée]ponse|Risposta|Juiste\s*antwoord)[\:\s\-\=\.]*[\(\[]?(?:Option\s*)?([A-D]|[1-4])?[\.\)\]]?/i.test(text.trim());
}

/**
 * Strips all prefixes, numbering ("1.", "Q1:", "Frage 1:"), and any accidental answer tags
 * ("Richtige Antwort: B", "Answer: B", "Antwort: B", etc.) from question text so only the pure question remains!
 */
export function cleanQuestionPrefix(text: string): string {
  if (!text) return '';
  let cleaned = text.trim();

  // Strip leading answer prefix if accidentally attached e.g. "Richtige Antwort: B", "Answer: B", "Antwort: B"
  cleaned = cleaned.replace(/^(?:(?:Richtige\s*Antwort|Korrekte\s*Antwort|Antwort|Richtig|L[öo]sung|L[öo]sungen|Korrekt|Answer|Ans|Correct(?:\s*Answer|\s*Option)?|Right\s*Answer|Jawab|Uttar|Jawaban|Respuesta(?:\s*correcta)?|R[ée]ponse(?:\s*correcte)?|Key)[\:\s\-\=\.]*[\(\[]?(?:Option\s*)?[A-D1-4]?[\.\)\]]?\s*)+/i, '');

  // Strip leading question numbering: "1.", "1 -", "Q1.", "Question 1:", "Frage 1:", "Frage 1 -", "(1)", "[1]"
  cleaned = cleaned.replace(/^(?:(?:\d{1,3}[\.\)\:\-\/]\s*)|(?:(?:Q(?:uestion)?|Frage|Pregunta|Domanda|Vraag|Pytanie|Sawal|Soru|Pertanyaan)\s*#?\d{1,3}[\.\:\-\)]?\s*)|(?:\#\d{1,3}[\.\:\s]+)|(?:\(\d{1,3}\)\s*)|(?:\[\d{1,3}\]\s*))/i, '');

  // Strip leading answer prefix again in case it was placed AFTER the question number (e.g. "1. Richtige Antwort: B What is...")
  cleaned = cleaned.replace(/^(?:(?:Richtige\s*Antwort|Korrekte\s*Antwort|Antwort|Richtig|L[öo]sung|L[öo]sungen|Korrekt|Answer|Ans|Correct(?:\s*Answer|\s*Option)?|Right\s*Answer|Jawab|Uttar|Jawaban|Respuesta(?:\s*correcta)?|R[ée]ponse(?:\s*correcte)?|Key)[\:\s\-\=\.]*[\(\[]?(?:Option\s*)?[A-D1-4]?[\.\)\]]?\s*)+/i, '');

  // Strip trailing answer tag if at the end of the question text (e.g. "... Richtige Antwort: B")
  cleaned = cleaned.replace(/(?:\s*[\-\|\•]\s*|\s+)(?:Richtige\s*Antwort|Korrekte\s*Antwort|Antwort|Richtig|L[öo]sung|L[öo]sungen|Korrekt|Answer|Ans|Correct(?:\s*Answer|\s*Option)?|Right\s*Answer|Jawab|Uttar|Jawaban|Respuesta(?:\s*correcta)?|R[ée]ponse(?:\s*correcte)?|Key)[\:\s\-\=\.]*[\(\[]?(?:Option\s*)?[A-D1-4]?[\.\)\]]?\s*$/i, '');

  return cleaned.trim();
}

/**
 * Strips leading option labels from option text (e.g. "A. Paris" -> "Paris")
 */
function cleanOptionText(text: string): string {
  if (!text) return '';
  return text.replace(/^[\(\[]?([A-D]|[1-4])[\.\)\]\:\-]\s*/i, '').trim();
}

/**
 * Resolves answer string to 'A' | 'B' | 'C' | 'D'
 */
function resolveAnswerLetter(ansStr: string, options: string[]): OptionLetter {
  const norm = (ansStr || '').trim().toUpperCase();
  if (['A', 'B', 'C', 'D'].includes(norm)) return norm as OptionLetter;
  if (norm.startsWith('OPTION ') || norm.startsWith('OPTION:')) {
    const l = norm.replace(/OPTION[:\s]*/i, '').trim()[0];
    if (['A', 'B', 'C', 'D'].includes(l)) return l as OptionLetter;
  }
  if (['1', '2', '3', '4'].includes(norm)) {
    return (['A', 'B', 'C', 'D'][parseInt(norm, 10) - 1]) as OptionLetter;
  }
  // Try matching option text
  if (norm) {
    for (let i = 0; i < options.length; i++) {
      if (options[i] && options[i].trim().toUpperCase() === norm) {
        return (['A', 'B', 'C', 'D'][i]) as OptionLetter;
      }
    }
  }
  return 'A';
}

/**
 * Extracts Option Letter from messy answer string
 */
function extractLetterFromText(text: string): OptionLetter | null {
  const m = text.match(/(?:Option\s*)?[\(\[]?([A-D])[\.\)\]]?/i);
  if (m && ['A', 'B', 'C', 'D'].includes(m[1].toUpperCase())) {
    return m[1].toUpperCase() as OptionLetter;
  }
  return null;
}

export function formatQuizToBulkText(items: QuizItem[]): string {
  return items
    .map((item, idx) => {
      const optionsText = item.options
        .map((opt, oIdx) => `${String.fromCharCode(65 + oIdx)}. ${opt}`)
        .join('\n');
      return `${idx + 1}. ${item.question}\n${optionsText}\nAnswer: ${item.answer}${
        item.explanation ? ` (${item.explanation})` : ''
      }`;
    })
    .join('\n\n');
}

"use node";

import { internalAction } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { internal } from "./_generated/api";

// ─── Subject Normalization (matching CLAUDE_Daily Transaction.md spec) ───

const SUBJECT_MAP: Record<string, string> = {
  eng: "English",
  english: "English",
  sci: "Science",
  science: "Science",
  math: "Math",
  maths: "Math",
  mathematics: "Math",
  ss: "Social Science",
  social: "Social Science",
  "social science": "Social Science",
  "social studies": "Social Science",
  cs: "Computer Science",
  computer: "Computer Science",
  computers: "Computer Science",
  "computer science": "Computer Science",
  "2l hindi": "Hindi (2L)",
  "2 l hindi": "Hindi (2L)",
  "3l hindi": "Hindi (3L)",
  "3 l hindi": "Hindi (3L)",
  hindi: "Hindi (2L)",
  "2l telugu": "Telugu (2L)",
  "2 l telugu": "Telugu (2L)",
  "3l telugu": "Telugu (3L)",
  "3 l telugu": "Telugu (3L)",
  telugu: "Telugu (2L)",
  "2l kannada": "Kannada (2L)",
  kannada: "Kannada (2L)",
  "2l tamil": "Tamil (2L)",
  tamil: "Tamil (2L)",
  mus: "Music",
  music: "Music",
  wd: "Western Dance",
  "western dance": "Western Dance",
  cd: "Classical Dance",
  "classical dance": "Classical Dance",
  "a/c": "Art & Craft",
  art: "Art & Craft",
  "art & craft": "Art & Craft",
  lib: "Library",
  library: "Library",
  yoga: "Yoga",
  sports: "Sports",
  pt: "Sports",
  evs: "EVS",
  gk: "General Knowledge",
  "general knowledge": "General Knowledge",
  "moral science": "Moral Science",
};

function normalizeSubject(raw: string): string {
  const trimmed = raw.trim();
  return SUBJECT_MAP[trimmed.toLowerCase()] ?? trimmed;
}

// All known subject tokens sorted longest-first for regex matching
// Includes both full names AND abbreviations used in Arbor school PDFs
const KNOWN_SUBJECT_TOKENS = [
  // Multi-word (must be before single-word to match first)
  "Social Science", "Social Studies", "Computer Science",
  "General Knowledge", "Moral Science", "Classical Dance",
  "Western Dance", "Art & Craft",
  "2L Hindi", "3L Hindi", "2 L Hindi", "2L Telugu", "3L Telugu", "2 L Telugu",
  "2L Kannada", "2L Tamil",
  // Full names
  "Social", "Science", "Math", "Maths", "Mathematics",
  "English", "Hindi", "Telugu", "Kannada", "Tamil",
  "Sports", "Art", "Music", "Computer", "Computers",
  "EVS", "Library", "Yoga",
  // Abbreviations used in school PDFs
  "Eng", "Sci", "SS", "CS", "GK", "PT",
  "Mus", "WD", "CD", "A/C",
].sort((a, b) => b.length - a.length);

// ─── No-homework detection (from CLAUDE.md spec) ───

const NO_HOMEWORK_PHRASES = [
  "no home task", "no homework", "no task", "self practice",
  "no home work", "nil", "no h.w",
];

function hasHomework(hometaskText: string): boolean {
  if (!hometaskText || hometaskText.trim().length === 0) return false;
  const lower = hometaskText.toLowerCase();
  return !NO_HOMEWORK_PHRASES.some((p) => lower.includes(p));
}

// ─── Date Extraction ───

const MONTH_NAMES: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function extractDateFromText(text: string): string | null {
  const patterns: Array<{ regex: RegExp; parse: (m: RegExpMatchArray) => { day: number; month: number; year: number } | null }> = [
    // School format: "Date: 6-04-'26" or "Date : 9-04-'26" (handles Unicode smart quotes)
    {
      regex: /Date\s*:\s*(\d{1,2})[\/\-.](\d{1,2})[\/\-.][\u0027\u2018\u2019\u0060]?(\d{2,4})/i,
      parse: (m) => ({
        day: parseInt(m[1]),
        month: parseInt(m[2]),
        year: m[3].length === 2 ? 2000 + parseInt(m[3]) : parseInt(m[3]),
      }),
    },
    // DD/MM/YYYY or DD-MM-YYYY full year
    {
      regex: /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\b/,
      parse: (m) => ({
        day: parseInt(m[1]),
        month: parseInt(m[2]),
        year: parseInt(m[3]),
      }),
    },
    // DD/MM/'YY abbreviated year (handles Unicode smart quotes)
    {
      regex: /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.][\u0027\u2018\u2019\u0060](\d{2})\b/,
      parse: (m) => ({
        day: parseInt(m[1]),
        month: parseInt(m[2]),
        year: 2000 + parseInt(m[3]),
      }),
    },
    // DD-Mon-YYYY e.g. "11-Apr-2026"
    {
      regex: /\b(\d{1,2})[\/\-.\s]+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\/\-.\s,]+(\d{4})\b/i,
      parse: (m) => {
        const mon = MONTH_NAMES[m[2].substring(0, 3).toLowerCase()];
        return mon ? { day: parseInt(m[1]), month: mon, year: parseInt(m[3]) } : null;
      },
    },
    // "Month DD, YYYY" e.g. "April 11, 2026"
    {
      regex: /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2})\s*,?\s*(\d{4})\b/i,
      parse: (m) => {
        const mon = MONTH_NAMES[m[1].substring(0, 3).toLowerCase()];
        return mon ? { day: parseInt(m[2]), month: mon, year: parseInt(m[3]) } : null;
      },
    },
  ];

  for (const { regex, parse } of patterns) {
    const match = text.match(regex);
    if (!match) continue;
    const result = parse(match);
    if (!result) continue;
    const { day, month, year } = result;
    if (year >= 2020 && year <= 2035 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      console.log(`[extractDateFromText] Found date in PDF: ${dateStr} (from "${match[0]}")`);
      return dateStr;
    }
  }

  return null;
}

// ─── Due date extraction from homework text ───

function extractDueDate(hometaskText: string, assignedDate: string): string {
  // Look for explicit dates in homework text (handle Unicode quotes)
  const datePatterns = [
    /(\d{1,2})[\/\-.](\d{1,2})[\/\-.][\u0027\u2018\u2019\u0060]?(\d{2,4})/,
    /(\d{1,2})(?:st|nd|rd|th)?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*/i,
  ];

  for (const pattern of datePatterns) {
    const m = hometaskText.match(pattern);
    if (m) {
      if (m[2] && MONTH_NAMES[m[2].substring(0, 3).toLowerCase()]) {
        const mon = MONTH_NAMES[m[2].substring(0, 3).toLowerCase()];
        const day = parseInt(m[1]);
        // Assume current/next year
        const baseYear = new Date().getFullYear();
        return `${baseYear}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      } else {
        const day = parseInt(m[1]);
        const month = parseInt(m[2]);
        const year = m[3].length === 2 ? 2000 + parseInt(m[3]) : parseInt(m[3]);
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        }
      }
    }
  }

  // Check for "tomorrow" or "next class"
  const lower = hometaskText.toLowerCase();
  if (lower.includes("tomorrow")) {
    return getNextSchoolDay(assignedDate);
  }
  if (lower.includes("next class") || lower.includes("submit")) {
    return getNextSchoolDay(assignedDate);
  }

  // Default: next school day
  return getNextSchoolDay(assignedDate);
}

// ─── Types ───

interface ExamInfo {
  examType: string;
  examDate: string;
  portions: string[];
  notes?: string;
}

interface SubjectEntry {
  name: string;
  classwork: string;
  homework: Array<{ description: string; dueDate: string }>;
  exams: ExamInfo[];
}

interface ExtractionResult {
  date: string;
  confidence: number;
  subjects: SubjectEntry[];
}

// ─── Exam/Test Detection ───

// Keywords that indicate an exam or test mention (from spec: exam, test, slip test, assessment, submission, correction)
const EXAM_KEYWORDS_REGEX =
  /\b(slip\s*test|unit\s*test|periodic\s*test|half[\s-]*yearly|annual\s*exam|exam|test|assessment|quiz|submit\w*|correction|workbook\s*correction|worksheet\s*submission|activity\s*submission)\b/i;

function classifyExamType(text: string): string {
  const lower = text.toLowerCase();
  if (/slip\s*test/.test(lower)) return "slip_test";
  if (/unit\s*test/.test(lower)) return "unit_test";
  if (/quiz/.test(lower)) return "quiz";
  if (/exam|half[\s-]*yearly|annual/.test(lower)) return "exam";
  // submission/correction/assessment/workbook correction → "other"
  return "other";
}

function extractExamInfo(block: string, subjectName: string, entryDate: string): ExamInfo[] {
  if (!EXAM_KEYWORDS_REGEX.test(block)) return [];

  const exams: ExamInfo[] = [];

  // Try to find specific exam mentions — split by common delimiters
  // The whole block mentions an exam keyword, so extract what we can
  const examType = classifyExamType(block);

  // Try to extract an exam date from the block text
  let examDate = "";
  // Look for date patterns within the block
  const datePatterns = [
    /(\d{1,2})[\/\-.](\d{1,2})[\/\-.][\u0027\u2018\u2019\u0060]?(\d{2,4})/,
    /(\d{1,2})(?:st|nd|rd|th)?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*/i,
  ];

  for (const pattern of datePatterns) {
    const m = block.match(pattern);
    if (m) {
      if (m[2] && MONTH_NAMES[m[2].substring(0, 3).toLowerCase()]) {
        const mon = MONTH_NAMES[m[2].substring(0, 3).toLowerCase()];
        const day = parseInt(m[1]);
        const baseYear = new Date().getFullYear();
        examDate = `${baseYear}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      } else if (m[2] && !isNaN(parseInt(m[2]))) {
        const day = parseInt(m[1]);
        const month = parseInt(m[2]);
        const year = m[3].length === 2 ? 2000 + parseInt(m[3]) : parseInt(m[3]);
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          examDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        }
      }
      break;
    }
  }

  // If no date found, use "TBA"
  if (!examDate) examDate = "TBA";

  // Extract portions/topics: look for chapter/page references or the full block as context
  const portions: string[] = [];
  const portionPatterns = [
    /(?:Ch(?:apter)?[\s.:]*\d+[^,;.]*)/gi,
    /(?:Pg[\s.:]*\d+[^,;.]*)/gi,
    /(?:Ls[\s.:-]*\d+[^,;.]*)/gi,
    /(?:Unit[\s.:]*\d+[^,;.]*)/gi,
    /(?:Lesson[\s.:]*\d+[^,;.]*)/gi,
  ];

  for (const pattern of portionPatterns) {
    let pm;
    while ((pm = pattern.exec(block)) !== null) {
      portions.push(pm[0].trim());
    }
  }

  // If no specific portions found, use the whole block as context
  if (portions.length === 0) {
    // Clean up the block and use it as the topic description
    const cleaned = block.replace(/\s+/g, " ").trim();
    if (cleaned.length > 0) portions.push(cleaned);
  }

  // Determine notes from the exam type context
  let notes: string | undefined;
  if (/submit|submission/i.test(block)) notes = "Check submission";
  if (/correction/i.test(block)) notes = "Workbook correction";

  exams.push({
    examType,
    examDate,
    portions,
    notes,
  });

  return exams;
}

// ─── Main Parser ───

function parseTransactionSheet(text: string, fallbackDate: string): ExtractionResult {
  // Extract the actual date from the PDF
  const extractedDate = extractDateFromText(text);
  const entryDate = extractedDate || fallbackDate;
  console.log(`[parseTransactionSheet] Date: ${entryDate} (extracted=${!!extractedDate})`);

  // Normalize whitespace but keep newlines
  let normalized = text.replace(/\r\n/g, "\n");

  // Strip everything before the data rows (after "Home task" header)
  const headerPattern = /Home\s*(?:task|work)/i;
  const headerMatch = normalized.match(headerPattern);
  if (headerMatch && headerMatch.index !== undefined) {
    const afterHeader = headerMatch.index + headerMatch[0].length;
    normalized = normalized.substring(afterHeader).trim();
  }

  // Flatten to a single string for subject scanning
  const flat = normalized.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  console.log(`[parseTransactionSheet] Data text (first 400): ${flat.substring(0, 400)}`);

  // Build regex to find subject names
  const escapedSubjects = KNOWN_SUBJECT_TOKENS.map((s) =>
    s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );
  const subjectRegex = new RegExp(
    `(?:^|\\s)(${escapedSubjects.join("|")})(?=\\s|$)`,
    "gi"
  );

  // Find all subject positions (allow duplicates — two English periods = two entries)
  const matches: Array<{ pos: number; name: string; matchEnd: number }> = [];
  const seenPositions = new Set<string>(); // track multi-word subjects to avoid sub-matches
  let m: RegExpExecArray | null;

  while ((m = subjectRegex.exec(flat)) !== null) {
    const rawName = m[1];
    const canonical = normalizeSubject(rawName);
    const startPos = m.index + m[0].indexOf(rawName);

    // Skip "Social" or "Science" if "Social Science" was already matched at nearby position
    if (rawName.toLowerCase() === "social" || rawName.toLowerCase() === "science") {
      const nearby = matches.some(
        (prev) => prev.name === "Social Science" && Math.abs(prev.pos - startPos) < 20
      );
      if (nearby) continue;
    }

    // Avoid matching the same position twice (e.g., "SS" inside "Social Science")
    const posKey = `${startPos}`;
    if (seenPositions.has(posKey)) continue;
    seenPositions.add(posKey);

    matches.push({ pos: startPos, name: canonical, matchEnd: startPos + rawName.length });
  }

  console.log(`[parseTransactionSheet] Found subjects: ${matches.map((m) => m.name).join(", ")}`);

  const subjects: SubjectEntry[] = [];

  // Extract the text block for each subject (from this subject to the next)
  for (let i = 0; i < matches.length; i++) {
    const startPos = matches[i].matchEnd;
    const endPos = i + 1 < matches.length ? matches[i + 1].pos : flat.length;
    const subjectName = matches[i].name;

    let block = flat.substring(startPos, endPos).trim();

    // Remove teacher name(s) at the start — "Ms. Name", "Mr. Name/Ms. Name", etc.
    block = block
      .replace(
        /^(?:(?:Ms\.|Mr\.|Mrs\.|Dr\.)\s*[A-Z][a-z]+(?:\s*\/\s*(?:Ms\.|Mr\.|Mrs\.|Dr\.)\s*[A-Z][a-z]+)*\s*)/i,
        ""
      )
      .trim();
    // Also strip standalone capitalized names (teacher names not prefixed)
    block = block
      .replace(
        /^(?:[A-Z][a-z]{1,12}(?:\s+[A-Z][a-z]{1,12}){0,2}\s+)(?=[A-Z])/m,
        ""
      )
      .trim();

    // Split into classwork and homework
    let classwork = "";
    let homeworkText = "";

    // Check for "No home task" variations
    const noHwPattern =
      /No\s+home\s*(?:task|work)\s*(?:for\s+the\s+day|given|today)?\.?/i;
    const noHwMatch = block.match(noHwPattern);

    if (noHwMatch && noHwMatch.index !== undefined) {
      classwork = block.substring(0, noHwMatch.index).trim();
      homeworkText = "";
    } else {
      // Try tab split
      const tabSplit = block.split("\t");
      if (tabSplit.length >= 2) {
        classwork = tabSplit.slice(0, -1).join(" ").trim();
        homeworkText = tabSplit[tabSplit.length - 1].trim();
      } else {
        // Heuristic: homework starts with action words
        const hwPattern =
          /\b(Complete\s|Do\s|Write\s|Learn\s|Revise\s|Rev[\.\s]|Pg[\.\s]|Page[\.\s]|Solve\s|Practice\s|Read\s+(?:ch|pg|and\s+learn)|Submit\s|Prepare\s|Memorise\s|Memorize\s|Worksheet|W\.?\s*S|WS[\s\-])/i;
        const hwMatch = block.match(hwPattern);
        if (hwMatch && hwMatch.index !== undefined && hwMatch.index > 5) {
          classwork = block.substring(0, hwMatch.index).trim();
          homeworkText = block.substring(hwMatch.index).trim();
        } else {
          classwork = block;
          homeworkText = "";
        }
      }
    }

    // Clean up page markers
    classwork = classwork.replace(/--\s*\d+\s*of\s*\d+\s*--/g, "").trim();
    homeworkText = homeworkText.replace(/--\s*\d+\s*of\s*\d+\s*--/g, "").trim();

    if (classwork || homeworkText) {
      const entry: SubjectEntry = {
        name: subjectName,
        classwork: classwork || "Classwork done",
        homework: [],
        exams: [],
      };

      // Only add homework if it's real homework (not "no homework" text)
      if (homeworkText && hasHomework(homeworkText)) {
        entry.homework.push({
          description: homeworkText,
          dueDate: extractDueDate(homeworkText, entryDate),
        });
      }

      // Detect exam/test/submission/correction mentions in the full block
      const fullBlock = (classwork + " " + homeworkText).trim();
      entry.exams = extractExamInfo(fullBlock, subjectName, entryDate);

      subjects.push(entry);
    }
  }

  console.log(
    `[parseTransactionSheet] Parsed ${subjects.length} subjects, ` +
      `${subjects.filter((s) => s.homework.length > 0).length} with homework, ` +
      `${subjects.filter((s) => s.exams.length > 0).length} with exams/tests`
  );

  return {
    date: entryDate,
    confidence: subjects.length > 0 ? 0.95 : 0.3,
    subjects,
  };
}

// ─── Helpers ───

function getNextSchoolDay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
  }
  return d.toISOString().split("T")[0];
}

// ─── PDF Text Extraction ───

async function extractPdfText(
  fileBuffer: ArrayBuffer
): Promise<{ text: string; isImagePdf: boolean }> {
  try {
    const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.mjs");
    const uint8 = new Uint8Array(fileBuffer);
    const doc = await pdfjsLib.getDocument({ data: uint8, useSystemFonts: true }).promise;

    let fullText = "";
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      let lastY = -1;
      let lineText = "";
      for (const item of content.items) {
        const ci = item as any;
        if (lastY !== -1 && Math.abs(ci.transform[5] - lastY) > 2) {
          fullText += lineText.trim() + "\n";
          lineText = "";
        }
        lineText += ci.str + (ci.hasEOL ? "\n" : " ");
        lastY = ci.transform[5];
      }
      if (lineText.trim()) fullText += lineText.trim() + "\n";
    }

    fullText = fullText.replace(/\n\n--\s*\d+\s*of\s*\d+\s*--\s*\n?/g, "").trim();
    console.log(`[extractPdfText] pdfjs-dist extracted ${fullText.length} chars`);

    if (fullText.length < 50) {
      return { text: "", isImagePdf: true };
    }
    return { text: fullText, isImagePdf: false };
  } catch (e: any) {
    console.log(`[extractPdfText] pdfjs-dist failed: ${e?.message}`);
    try {
      const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");
      const uint8 = new Uint8Array(fileBuffer);
      const doc = await pdfjsLib.getDocument({ data: uint8 }).promise;
      let fullText = "";
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        fullText += content.items.map((item: any) => item.str).join(" ") + "\n";
      }
      fullText = fullText.trim();
      console.log(`[extractPdfText] pdfjs-dist .js extracted ${fullText.length} chars`);
      if (fullText.length >= 50) return { text: fullText, isImagePdf: false };
    } catch (e2: any) {
      console.log(`[extractPdfText] pdfjs-dist .js also failed: ${e2?.message}`);
    }
    return { text: "", isImagePdf: true };
  }
}

// ─── Process Entry Action ───

export const processEntry = internalAction({
  args: {
    entryId: v.id("schoolEntries"),
    extractedText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const entry = await ctx.runQuery(internal.schoolEntries.getEntry, {
      entryId: args.entryId,
    });
    if (!entry) throw new ConvexError("School entry not found");

    const recentCount = await ctx.runQuery(
      internal.schoolEntries.countRecentForParent,
      { parentId: entry.parentId }
    );
    if (recentCount >= 10) {
      await ctx.runMutation(internal.schoolEntries.updateStatus, {
        entryId: args.entryId,
        processingStatus: "failed",
        errorMessage: "Rate limit reached. Maximum 10 PDFs per hour.",
      });
      return;
    }

    await ctx.runMutation(internal.schoolEntries.updateStatus, {
      entryId: args.entryId,
      processingStatus: "processing",
    });

    try {
      const fileBlob = await ctx.storage.get(entry.fileStorageId);
      if (!fileBlob) {
        await ctx.runMutation(internal.schoolEntries.updateStatus, {
          entryId: args.entryId,
          processingStatus: "failed",
          errorMessage: "PDF file not found in storage",
        });
        return;
      }

      const fileBuffer = await fileBlob.arrayBuffer();

      // Text priority: action arg > stored in entry > server-side extraction
      let text = (args.extractedText || (entry as any).extractedText || "").trim();
      let isImagePdf = false;
      if (text.length < 50) {
        const extracted = await extractPdfText(fileBuffer);
        text = extracted.text;
        isImagePdf = extracted.isImagePdf;
      }

      console.log(
        `[processEntry] File: ${entry.fileName}, isImage: ${isImagePdf}, textLen: ${text.length}, fromBrowser: ${!!args.extractedText}`
      );

      let extractionResult: ExtractionResult;

      if (text.length > 50) {
        extractionResult = parseTransactionSheet(text, entry.entryDate);
        console.log(
          `[processEntry] Direct parse: ${extractionResult.subjects.length} subjects, date: ${extractionResult.date}`
        );
      } else {
        throw new Error(
          "Could not extract text from PDF. Text length: " +
            text.length +
            ". Browser extraction: " +
            (args.extractedText ? "provided but empty" : "not provided") +
            ". Please try re-uploading."
        );
      }

      const rawJson = JSON.stringify(extractionResult);
      const actualDate = extractionResult.date;

      // If the PDF contained a different date, update the schoolEntry
      if (actualDate !== entry.entryDate) {
        await ctx.runMutation(internal.schoolEntries.updateEntryDate, {
          entryId: args.entryId,
          entryDate: actualDate,
        });
      }

      // Store extracted items
      const homeworkItems: Array<{
        subject: string;
        description: string;
        dueDate: string;
        assignedDate: string;
      }> = [];
      const classworkItems: Array<{
        subject: string;
        topicsCovered: string[];
        entryDate: string;
      }> = [];
      const examItems: Array<{
        subject: string;
        examType: string;
        examDate: string;
        portions: string[];
        notes?: string;
        announcedDate: string;
      }> = [];

      for (const subject of extractionResult.subjects ?? []) {
        for (const hw of subject.homework ?? []) {
          homeworkItems.push({
            subject: subject.name,
            description: hw.description,
            dueDate: hw.dueDate || getNextSchoolDay(actualDate),
            assignedDate: actualDate,
          });
        }
        if (subject.classwork) {
          classworkItems.push({
            subject: subject.name,
            topicsCovered: [subject.classwork],
            entryDate: actualDate,
          });
        }
        for (const exam of subject.exams ?? []) {
          examItems.push({
            subject: subject.name,
            examType: exam.examType,
            examDate: exam.examDate,
            portions: exam.portions,
            notes: exam.notes,
            announcedDate: actualDate,
          });
        }
      }

      if (homeworkItems.length > 0) {
        await ctx.runMutation(internal.schoolEntries.storeHomeworkItems, {
          schoolEntryId: args.entryId,
          childId: entry.childId,
          parentId: entry.parentId,
          items: homeworkItems,
        });
      }

      if (classworkItems.length > 0) {
        await ctx.runMutation(internal.schoolEntries.storeClassworkItems, {
          schoolEntryId: args.entryId,
          childId: entry.childId,
          parentId: entry.parentId,
          items: classworkItems,
        });
      }

      if (examItems.length > 0) {
        await ctx.runMutation(internal.schoolEntries.storeExamItems, {
          schoolEntryId: args.entryId,
          childId: entry.childId,
          parentId: entry.parentId,
          items: examItems,
        });
      }

      await ctx.runMutation(internal.schoolEntries.updateStatus, {
        entryId: args.entryId,
        processingStatus: "complete",
        extractionConfidence: extractionResult.confidence,
        rawExtractedJson: rawJson,
        processedAt: Date.now(),
      });
    } catch (error: any) {
      const retryCount = entry.retryCount ?? 0;
      const isRetriable =
        error?.status === 429 ||
        error?.code === "ETIMEDOUT" ||
        error?.message?.includes("timeout") ||
        error?.message?.includes("rate limit");

      if (isRetriable && retryCount < 3) {
        const delays = [60_000, 300_000, 900_000];
        await ctx.runMutation(internal.schoolEntries.updateStatus, {
          entryId: args.entryId,
          processingStatus: "pending",
          retryCount: retryCount + 1,
          errorMessage: `Retry ${retryCount + 1}/3: ${error?.message ?? "Unknown error"}`,
        });
        await ctx.scheduler.runAfter(
          delays[retryCount],
          internal.processEntry.processEntry,
          { entryId: args.entryId }
        );
      } else {
        await ctx.runMutation(internal.schoolEntries.updateStatus, {
          entryId: args.entryId,
          processingStatus: "failed",
          errorMessage: error?.message ?? "Unknown processing error",
          processedAt: Date.now(),
        });
      }
    }
  },
});

// Reprocess all entries: clear items, reset entries, and re-schedule processing
export const reprocessAll = internalAction({
  args: {},
  handler: async (ctx): Promise<{ scheduled: number }> => {
    // Step 1: Clear all extracted items and reset entries
    const result = await ctx.runMutation(internal.schoolEntries.resetForReprocess);
    console.log(`[reprocessAll] Reset: ${result.deletedItems} items deleted, ${result.resetEntries} entries reset`);

    // Step 2: Get all pending entries and schedule processing
    const entries: Array<{ _id: any }> = await ctx.runQuery(internal.schoolEntries.listPendingEntries);
    for (let i = 0; i < entries.length; i++) {
      // Stagger processing to avoid rate limits (2s between each)
      await ctx.scheduler.runAfter(i * 2000, internal.processEntry.processEntry, {
        entryId: entries[i]._id,
      });
    }

    console.log(`[reprocessAll] Scheduled ${entries.length} entries for reprocessing`);
    return { scheduled: entries.length };
  },
});

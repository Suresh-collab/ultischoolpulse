"use node";

import { internalAction } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { internal } from "./_generated/api";

// Known subject names in Indian school Daily Transaction Sheets
const KNOWN_SUBJECTS = [
  "Social Science", "Social Studies", "Social",
  "Science", "Math", "Maths", "Mathematics",
  "English", "Hindi", "2L Hindi", "2L Telugu", "Telugu",
  "2L Kannada", "Kannada", "2L Tamil", "Tamil",
  "Sports", "PT", "Art", "Music", "Computer", "Computers",
  "EVS", "GK", "General Knowledge", "Moral Science",
];

export const processEntry = internalAction({
  args: { entryId: v.id("schoolEntries"), extractedText: v.optional(v.string()) },
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

      // Use pre-extracted text from browser if available, otherwise try server-side
      let text = (args.extractedText || "").trim();
      let isImagePdf = false;
      if (text.length < 50) {
        const extracted = await extractPdfText(fileBuffer);
        text = extracted.text;
        isImagePdf = extracted.isImagePdf;
      }

      console.log(`[processEntry] File: ${entry.fileName}, isImage: ${isImagePdf}, textLen: ${text.length}, fromBrowser: ${!!args.extractedText}`);

      let extractionResult: ExtractionResult;

      if (text.length > 50) {
        // Text available: parse directly, no AI hallucination
        extractionResult = parseTransactionSheet(text, entry.entryDate);
        console.log(`[processEntry] Direct parse: ${extractionResult.subjects.length} subjects`);
      } else {
        // No text extracted — fail with clear message
        throw new Error(
          "Could not extract text from PDF. Text length: " + text.length +
          ". Browser extraction: " + (args.extractedText ? "provided but empty" : "not provided") +
          ". Please try re-uploading."
        );
      }

      const rawJson = JSON.stringify(extractionResult);
      console.log(`[processEntry] Result: ${extractionResult.subjects.map(s => s.name).join(", ")}`);

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

      for (const subject of extractionResult.subjects ?? []) {
        for (const hw of subject.homework ?? []) {
          homeworkItems.push({
            subject: subject.name,
            description: hw.description,
            dueDate: hw.dueDate || getNextSchoolDay(entry.entryDate),
            assignedDate: entry.entryDate,
          });
        }
        if (subject.classwork) {
          classworkItems.push({
            subject: subject.name,
            topicsCovered: [subject.classwork],
            entryDate: entry.entryDate,
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

// ─── Types ───

interface SubjectEntry {
  name: string;
  classwork: string; // verbatim text from "Class transaction" column
  homework: Array<{ description: string; dueDate: string }>;
}

interface ExtractionResult {
  date: string;
  confidence: number;
  subjects: SubjectEntry[];
}

// ─── Direct Text Parser (no AI) ───

function parseTransactionSheet(text: string, entryDate: string): ExtractionResult {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const subjects: SubjectEntry[] = [];

  // Find the header row to know where data starts
  let dataStartIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("Class transaction") || lines[i].includes("Home task")) {
      dataStartIndex = i + 1;
      break;
    }
  }

  // Join all data lines into one string for easier parsing
  const dataText = lines.slice(dataStartIndex).join("\n");

  // Split by known subject names
  const subjectPattern = new RegExp(
    `^(${KNOWN_SUBJECTS.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
    "im"
  );

  // Find all subject positions
  const allLines = dataText.split("\n");
  const subjectStarts: Array<{ index: number; name: string }> = [];

  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i].trim();
    // Check if line starts with a known subject
    for (const subj of KNOWN_SUBJECTS) {
      if (line.toLowerCase().startsWith(subj.toLowerCase()) &&
          (line.length === subj.length || /\s/.test(line[subj.length]) || line[subj.length] === "\t")) {
        // Handle "Social\nScience" split across lines
        let fullName = subj;
        if (subj === "Social" && i + 1 < allLines.length && allLines[i + 1].trim().toLowerCase() === "science") {
          fullName = "Social Science";
        }
        subjectStarts.push({ index: i, name: fullName });
        break;
      }
    }
  }

  // Extract data for each subject
  for (let s = 0; s < subjectStarts.length; s++) {
    const start = subjectStarts[s].index;
    const end = s + 1 < subjectStarts.length ? subjectStarts[s + 1].index : allLines.length;
    const subjectName = subjectStarts[s].name;

    // Get all text for this subject block
    const blockLines = allLines.slice(start, end);
    const blockText = blockLines.join(" ").replace(/\s+/g, " ").trim();

    // Remove subject name and teacher name from start
    // Pattern: "Subject TeacherName ClassTransaction HomeTask"
    // Teacher names follow pattern: "Ms./Mr./Mrs. Name" or just a name
    let remaining = blockText;

    // Remove subject name
    if (subjectName === "Social Science") {
      remaining = remaining.replace(/^Social\s+Science\s*/i, "");
    } else {
      remaining = remaining.replace(new RegExp(`^${subjectName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`, "i"), "");
    }

    // Remove teacher name(s) — pattern: Ms./Mr./Mrs. Name or multiple names
    remaining = remaining.replace(/^(?:(?:Ms\.|Mr\.|Mrs\.)\s*\w+(?:\/(?:Ms\.|Mr\.|Mrs\.)\s*\w+)*\s*)/i, "").trim();
    // Also handle names without prefix that might remain
    remaining = remaining.replace(/^(?:[A-Z][a-z]+\s+(?:[A-Z][a-z]+\s+)*)/m, "").trim();

    // Now split into classwork and homework using "No home task" or homework indicators
    let classwork = "";
    let homework = "";

    const noHomeworkPattern = /No\s+home\s+task\s+for\s+the\s+day\.?/i;
    const noHomeworkMatch = remaining.match(noHomeworkPattern);

    if (noHomeworkMatch) {
      classwork = remaining.substring(0, noHomeworkMatch.index!).trim();
      homework = "";
    } else {
      // Try to find where homework starts — look for homework-like patterns
      // Homework usually starts with page numbers, "Complete", "Do", "Write", "Learn", etc.
      // Or after the classwork description ends with a period/sentence
      // For these PDFs, the home task column content tends to follow the class transaction
      // Simple heuristic: if there's a tab character, split there
      const tabSplit = remaining.split("\t");
      if (tabSplit.length >= 2) {
        classwork = tabSplit.slice(0, -1).join(" ").trim();
        homework = tabSplit[tabSplit.length - 1].trim();
      } else {
        // No clear separator — the whole block might be classwork
        classwork = remaining;
        homework = "";
      }
    }

    // Clean up trailing "-- 1 of 1 --" or similar
    classwork = classwork.replace(/--\s*\d+\s*of\s*\d+\s*--/g, "").trim();
    homework = homework.replace(/--\s*\d+\s*of\s*\d+\s*--/g, "").trim();

    if (classwork || homework) {
      const entry: SubjectEntry = {
        name: subjectName,
        classwork: classwork || "Classwork done",
        homework: [],
      };

      if (homework && !noHomeworkPattern.test(homework)) {
        entry.homework.push({
          description: homework,
          dueDate: getNextSchoolDay(entryDate),
        });
      }

      subjects.push(entry);
    }
  }

  return {
    date: entryDate,
    confidence: subjects.length > 0 ? 0.95 : 0.3,
    subjects,
  };
}

function getNextSchoolDay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + 1);
  // Skip Saturday (6) and Sunday (0)
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
    // Use pdfjs-dist directly — works in Node.js without DOM
    const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.mjs");
    const uint8 = new Uint8Array(fileBuffer);
    const doc = await pdfjsLib.getDocument({ data: uint8, useSystemFonts: true }).promise;

    let fullText = "";
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      // Reconstruct text preserving line breaks using Y-position changes
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
    // Try .cjs variant
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

// ─── AI Fallback (only for image-based PDFs) ───

async function callAiExtraction(
  content: ArrayBuffer,
  entryDate: string,
  schoolName: string,
  childName: string
): Promise<ExtractionResult> {
  const OpenAI = require("openai");
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const base64 = Buffer.from(content).toString("base64");

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `Extract data from this school Daily Transaction Sheet image. Copy text EXACTLY as written. Output JSON: {"date":"${entryDate}","confidence":0.8,"subjects":[{"name":"SubjectName","classwork":"EXACT text from Class transaction column","homework":[{"description":"EXACT homework text","dueDate":"YYYY-MM-DD"}]}]}. If no homework, use empty array []. Include ALL subjects.`,
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Extract every subject row. Copy text verbatim." },
          {
            type: "image_url",
            image_url: { url: `data:application/pdf;base64,${base64}`, detail: "high" },
          },
        ],
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0,
    max_tokens: 4096,
  });

  const rawContent = response.choices[0]?.message?.content;
  if (!rawContent) throw new Error("AI returned empty response");

  const parsed = JSON.parse(rawContent);
  if (typeof parsed.confidence !== "number") parsed.confidence = 0.7;

  return parsed;
}

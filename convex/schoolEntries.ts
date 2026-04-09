import {
  internalMutation,
  internalAction,
  internalQuery,
  query,
} from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// Internal mutation: create a new schoolEntry (called from HTTP action)
export const createEntry = internalMutation({
  args: {
    childId: v.string(),
    fileName: v.string(),
    fileStorageId: v.id("_storage"),
    entryDate: v.string(),
  },
  handler: async (ctx, args) => {
    // Look up the child to get parentId
    const child = await ctx.db.get(args.childId as Id<"children">);
    if (!child) throw new ConvexError("Child not found");

    return await ctx.db.insert("schoolEntries", {
      childId: args.childId as Id<"children">,
      parentId: child.parentId,
      fileStorageId: args.fileStorageId,
      fileName: args.fileName,
      entryDate: args.entryDate,
      processingStatus: "pending",
      createdAt: Date.now(),
    });
  },
});

// List school entries for a child (authenticated query)
export const listForChild = query({
  args: {
    childId: v.id("children"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthenticated");

    const entries = await ctx.db
      .query("schoolEntries")
      .withIndex("by_childId", (q) => q.eq("childId", args.childId))
      .order("desc")
      .take(args.limit ?? 20);

    return entries;
  },
});

// Internal mutation: update entry status
export const updateStatus = internalMutation({
  args: {
    entryId: v.id("schoolEntries"),
    processingStatus: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("complete"),
      v.literal("failed"),
      v.literal("low_confidence")
    ),
    extractionConfidence: v.optional(v.number()),
    rawExtractedJson: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    retryCount: v.optional(v.number()),
    processedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { entryId, ...fields } = args;
    // Remove undefined fields
    const update: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) update[key] = value;
    }
    await ctx.db.patch(entryId, update);
  },
});

// Internal mutation: store extracted homework items
export const storeHomeworkItems = internalMutation({
  args: {
    schoolEntryId: v.id("schoolEntries"),
    childId: v.id("children"),
    parentId: v.id("users"),
    items: v.array(
      v.object({
        subject: v.string(),
        description: v.string(),
        dueDate: v.string(),
        assignedDate: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    for (const item of args.items) {
      // Deduplicate: check if same homework already exists
      const existing = await ctx.db
        .query("homeworkItems")
        .withIndex("by_childId_and_dueDate")
        .filter((q) =>
          q.and(
            q.eq(q.field("childId"), args.childId),
            q.eq(q.field("dueDate"), item.dueDate),
            q.eq(q.field("subject"), item.subject),
            q.eq(q.field("description"), item.description),
            q.eq(q.field("assignedDate"), item.assignedDate)
          )
        )
        .first();

      if (!existing) {
        await ctx.db.insert("homeworkItems", {
          schoolEntryId: args.schoolEntryId,
          childId: args.childId,
          parentId: args.parentId,
          subject: item.subject,
          description: item.description,
          dueDate: item.dueDate,
          assignedDate: item.assignedDate,
          isComplete: false,
          createdAt: Date.now(),
        });
      }
    }
  },
});

// Internal mutation: store extracted classwork items
export const storeClassworkItems = internalMutation({
  args: {
    schoolEntryId: v.id("schoolEntries"),
    childId: v.id("children"),
    parentId: v.id("users"),
    items: v.array(
      v.object({
        subject: v.string(),
        topicsCovered: v.array(v.string()),
        notes: v.optional(v.string()),
        entryDate: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    for (const item of args.items) {
      await ctx.db.insert("classworkItems", {
        schoolEntryId: args.schoolEntryId,
        childId: args.childId,
        parentId: args.parentId,
        subject: item.subject,
        topicsCovered: item.topicsCovered,
        notes: item.notes,
        entryDate: item.entryDate,
        createdAt: Date.now(),
      });
    }
  },
});

// Internal mutation: store extracted exam items
export const storeExamItems = internalMutation({
  args: {
    schoolEntryId: v.id("schoolEntries"),
    childId: v.id("children"),
    parentId: v.id("users"),
    items: v.array(
      v.object({
        subject: v.string(),
        examType: v.string(),
        examDate: v.string(),
        portions: v.array(v.string()),
        notes: v.optional(v.string()),
        announcedDate: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const validExamTypes = [
      "slip_test",
      "unit_test",
      "exam",
      "quiz",
      "other",
    ] as const;

    for (const item of args.items) {
      // Deduplicate: check for existing exam with same child + subject + date
      const existing = await ctx.db
        .query("examItems")
        .withIndex("by_childId_and_examDate")
        .filter((q) =>
          q.and(
            q.eq(q.field("childId"), args.childId),
            q.eq(q.field("examDate"), item.examDate),
            q.eq(q.field("subject"), item.subject)
          )
        )
        .first();

      if (!existing) {
        const examType = validExamTypes.includes(item.examType as any)
          ? (item.examType as (typeof validExamTypes)[number])
          : "other";

        await ctx.db.insert("examItems", {
          schoolEntryId: args.schoolEntryId,
          childId: args.childId,
          parentId: args.parentId,
          subject: item.subject,
          examType,
          examDate: item.examDate,
          portions: item.portions,
          notes: item.notes,
          announcedDate: item.announcedDate,
          isAcknowledged: false,
          createdAt: Date.now(),
        });
      }
    }
  },
});

// The main processing action — extracts data from PDF and stores results
export const processEntry = internalAction({
  args: { entryId: v.id("schoolEntries") },
  handler: async (ctx, args) => {
    // Get the entry
    const entry = await ctx.runQuery(internal.schoolEntries.getEntry, {
      entryId: args.entryId,
    });
    if (!entry) throw new ConvexError("School entry not found");

    // Rate limit: max 10 PDFs per parent per hour
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

    // Update status to processing
    await ctx.runMutation(internal.schoolEntries.updateStatus, {
      entryId: args.entryId,
      processingStatus: "processing",
    });

    try {
      // Retrieve PDF from storage
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

      // Extract text from PDF
      const { text, isImagePdf } = await extractPdfText(fileBuffer);

      // Get child info for context
      const child = await ctx.runQuery(internal.schoolEntries.getChild, {
        childId: entry.childId,
      });

      // Call AI extraction
      const extractionResult = await callAiExtraction(
        isImagePdf ? fileBuffer : text,
        isImagePdf,
        entry.entryDate,
        child?.schoolName ?? "Unknown School",
        child?.name ?? "Student"
      );

      // Store raw JSON
      const rawJson = JSON.stringify(extractionResult);

      if (extractionResult.confidence >= 0.85) {
        // High confidence — store extracted items
        const homeworkItems: Array<{
          subject: string;
          description: string;
          dueDate: string;
          assignedDate: string;
        }> = [];
        const classworkItems: Array<{
          subject: string;
          topicsCovered: string[];
          notes?: string;
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
              dueDate: hw.dueDate || entry.entryDate,
              assignedDate: entry.entryDate,
            });
          }
          for (const cw of subject.classwork ?? []) {
            classworkItems.push({
              subject: subject.name,
              topicsCovered: cw.topics ?? [],
              entryDate: entry.entryDate,
            });
          }
        }

        for (const exam of extractionResult.exams ?? []) {
          examItems.push({
            subject: exam.subject,
            examType: exam.examType ?? "other",
            examDate: exam.examDate,
            portions: exam.portions ?? [],
            announcedDate: entry.entryDate,
          });
        }

        // Store all extracted items
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
      } else {
        // Low confidence
        await ctx.runMutation(internal.schoolEntries.updateStatus, {
          entryId: args.entryId,
          processingStatus: "low_confidence",
          extractionConfidence: extractionResult.confidence,
          rawExtractedJson: rawJson,
          processedAt: Date.now(),
        });
      }
    } catch (error: any) {
      const retryCount = entry.retryCount ?? 0;
      const isRetriable =
        error?.status === 429 ||
        error?.code === "ETIMEDOUT" ||
        error?.message?.includes("timeout") ||
        error?.message?.includes("rate limit");

      if (isRetriable && retryCount < 3) {
        // Schedule retry with exponential backoff
        const delays = [60_000, 300_000, 900_000]; // 1min, 5min, 15min
        await ctx.runMutation(internal.schoolEntries.updateStatus, {
          entryId: args.entryId,
          processingStatus: "pending",
          retryCount: retryCount + 1,
          errorMessage: `Retry ${retryCount + 1}/3: ${error?.message ?? "Unknown error"}`,
        });
        await ctx.scheduler.runAfter(
          delays[retryCount],
          internal.schoolEntries.processEntry,
          { entryId: args.entryId }
        );
      } else {
        // Permanent failure
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

// Internal query: get a single entry by ID
export const getEntry = internalQuery({
  args: { entryId: v.id("schoolEntries") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.entryId);
  },
});

// Internal query: count recent entries for rate limiting
export const countRecentForParent = internalQuery({
  args: { parentId: v.id("users") },
  handler: async (ctx, args) => {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const recent = await ctx.db
      .query("schoolEntries")
      .withIndex("by_parentId_and_date")
      .filter((q) =>
        q.and(
          q.eq(q.field("parentId"), args.parentId),
          q.gte(q.field("createdAt"), oneHourAgo)
        )
      )
      .collect();
    return recent.length;
  },
});

// Internal query: get child info
export const getChild = internalQuery({
  args: { childId: v.id("children") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.childId);
  },
});

// ─── PDF Text Extraction ───

async function extractPdfText(
  fileBuffer: ArrayBuffer
): Promise<{ text: string; isImagePdf: boolean }> {
  try {
    const pdfParse = require("pdf-parse");
    const buffer = Buffer.from(fileBuffer);
    const data = await pdfParse(buffer);
    const text = (data.text || "").trim();

    if (text.length < 100) {
      return { text: "", isImagePdf: true };
    }

    return { text, isImagePdf: false };
  } catch (error: any) {
    // pdf-parse failures — could be corrupt, password-protected, etc.
    const message = error?.message ?? "";
    if (message.includes("decrypt") || message.includes("password")) {
      throw new Error("PDF is password-protected");
    }
    if (message.includes("Invalid") || message.includes("empty")) {
      throw new Error("PDF appears to be empty or corrupt");
    }
    return { text: "", isImagePdf: true };
  }
}

// ─── AI Extraction ───

interface ExtractionResult {
  date: string;
  confidence: number;
  subjects: Array<{
    name: string;
    homework: Array<{ description: string; dueDate?: string }>;
    classwork: Array<{ topics: string[] }>;
  }>;
  exams: Array<{
    subject: string;
    examType: string;
    examDate: string;
    portions: string[];
  }>;
}

async function callAiExtraction(
  content: string | ArrayBuffer,
  isImage: boolean,
  entryDate: string,
  schoolName: string,
  childName: string
): Promise<ExtractionResult> {
  const OpenAI = require("openai");
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const systemPrompt = `You are a school document analyzer. Extract homework, classwork, and exam information from school communication PDFs.

Context:
- School: ${schoolName}
- Student: ${childName}
- Document date: ${entryDate}

Extract the following into structured JSON:
- date: The date this document covers (YYYY-MM-DD format)
- confidence: A float from 0 to 1 indicating how confident you are in the extraction accuracy
- subjects: Array of subjects, each with:
  - name: Subject name (e.g., "Mathematics", "Science")
  - homework: Array of { description: string, dueDate: string (YYYY-MM-DD) }
  - classwork: Array of { topics: string[] }
- exams: Array of { subject: string, examType: string (one of: slip_test, unit_test, exam, quiz, other), examDate: string (YYYY-MM-DD), portions: string[] }

Rules:
- If a date is relative (e.g., "next Friday"), resolve it based on the entry date ${entryDate}
- If you cannot determine a value with confidence, omit the field and reduce the confidence score
- For homework with no explicit due date, use the next school day after the entry date
- Return ONLY valid JSON, no markdown or explanation`;

  const messages: any[] = [{ role: "system", content: systemPrompt }];

  if (isImage && content instanceof ArrayBuffer) {
    // Convert PDF buffer to base64 for vision
    const base64 = Buffer.from(content).toString("base64");
    messages.push({
      role: "user",
      content: [
        {
          type: "text",
          text: "Extract all homework, classwork, and exam information from this school document image.",
        },
        {
          type: "image_url",
          image_url: {
            url: `data:application/pdf;base64,${base64}`,
            detail: "high",
          },
        },
      ],
    });
  } else {
    messages.push({
      role: "user",
      content: `Extract all homework, classwork, and exam information from this school document:\n\n${content}`,
    });
  }

  let response;
  try {
    response = await client.chat.completions.create({
      model: "gpt-4o",
      messages,
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 4096,
    });
  } catch (error: any) {
    // If first attempt fails, retry with simplified prompt
    if (
      error?.status !== 429 &&
      !error?.message?.includes("timeout")
    ) {
      try {
        response = await client.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Extract homework and exam data as JSON from this text:\n\n${typeof content === "string" ? content.slice(0, 3000) : "(image-based PDF)"}`,
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
          max_tokens: 2048,
        });
      } catch {
        throw error; // Re-throw original error if retry also fails
      }
    } else {
      throw error; // Let rate limit / timeout errors propagate for retry logic
    }
  }

  const rawContent = response.choices[0]?.message?.content;
  if (!rawContent) {
    throw new Error("AI returned empty response");
  }

  let parsed: ExtractionResult;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    throw new Error("AI returned invalid JSON");
  }

  // Ensure confidence is present and valid
  if (typeof parsed.confidence !== "number" || parsed.confidence < 0 || parsed.confidence > 1) {
    parsed.confidence = 0.5;
  }

  return parsed;
}

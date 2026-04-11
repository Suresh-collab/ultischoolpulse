import {
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { v, ConvexError } from "convex/values";
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
      // Check if same homework already exists for this child+subject+date
      const existing = await ctx.db
        .query("homeworkItems")
        .withIndex("by_childId_and_dueDate")
        .filter((q) =>
          q.and(
            q.eq(q.field("childId"), args.childId),
            q.eq(q.field("dueDate"), item.dueDate),
            q.eq(q.field("subject"), item.subject),
            q.eq(q.field("assignedDate"), item.assignedDate)
          )
        )
        .first();

      if (existing) {
        // Update existing item if description changed (re-upload with corrections)
        if (existing.description !== item.description) {
          await ctx.db.patch(existing._id, {
            description: item.description,
            schoolEntryId: args.schoolEntryId,
          });
        }
      } else {
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
      // Check if same subject+date classwork already exists
      const existing = await ctx.db
        .query("classworkItems")
        .withIndex("by_childId_and_date")
        .filter((q) =>
          q.and(
            q.eq(q.field("childId"), args.childId),
            q.eq(q.field("entryDate"), item.entryDate),
            q.eq(q.field("subject"), item.subject)
          )
        )
        .first();

      if (existing) {
        // Update existing item if content changed (re-upload with corrections)
        const topicsChanged = JSON.stringify(existing.topicsCovered) !== JSON.stringify(item.topicsCovered);
        if (topicsChanged || existing.notes !== item.notes) {
          await ctx.db.patch(existing._id, {
            topicsCovered: item.topicsCovered,
            notes: item.notes,
            schoolEntryId: args.schoolEntryId,
          });
        }
      } else {
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

// Internal query: list all pending entries (for reprocessing)
export const listPendingEntries = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("schoolEntries")
      .withIndex("by_status", (q) => q.eq("processingStatus", "pending"))
      .collect();
  },
});

// Internal mutation: update the entry date (when PDF contains the actual date)
export const updateEntryDate = internalMutation({
  args: {
    entryId: v.id("schoolEntries"),
    entryDate: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.entryId, { entryDate: args.entryDate });
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

// Public query: get recent low-confidence or failed entries for a child
export const getRecentIssues = query({
  args: {
    childId: v.id("children"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return [];

    // Get entries from last 2 days that have issues
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const cutoffDate = twoDaysAgo.toISOString().split("T")[0];

    const entries = await ctx.db
      .query("schoolEntries")
      .withIndex("by_childId", (q) => q.eq("childId", args.childId))
      .filter((q: any) =>
        q.and(
          q.gte(q.field("entryDate"), cutoffDate),
          q.or(
            q.eq(q.field("processingStatus"), "low_confidence"),
            q.eq(q.field("processingStatus"), "failed")
          )
        )
      )
      .collect();

    // Get PDF URLs for each entry
    const entriesWithUrls = await Promise.all(
      entries.map(async (entry) => {
        const url = await ctx.storage.getUrl(entry.fileStorageId);
        return { ...entry, pdfUrl: url };
      })
    );

    return entriesWithUrls;
  },
});

// Public query: get pending/processing entries for a child (real-time status)
// Entries older than 10 minutes are considered stale and excluded.
export const getPendingForChild = query({
  args: {
    childId: v.id("children"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const today = new Date().toISOString().split("T")[0];
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;

    const entries = await ctx.db
      .query("schoolEntries")
      .withIndex("by_childId", (q) => q.eq("childId", args.childId))
      .filter((q: any) =>
        q.and(
          q.eq(q.field("entryDate"), today),
          q.or(
            q.eq(q.field("processingStatus"), "pending"),
            q.eq(q.field("processingStatus"), "processing")
          )
        )
      )
      .collect();

    // Filter out stale entries (stuck > 10 min) and mark them failed
    const active: typeof entries = [];
    for (const entry of entries) {
      if (entry.createdAt < tenMinutesAgo) {
        // Stale — will be marked failed by the expireStale mutation
        continue;
      }
      active.push(entry);
    }

    return active;
  },
});

// Internal mutation: mark stale pending/processing entries as failed
export const expireStaleEntries = internalMutation({
  args: {},
  handler: async (ctx) => {
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;

    const pendingEntries = await ctx.db
      .query("schoolEntries")
      .withIndex("by_status", (q) => q.eq("processingStatus", "pending"))
      .filter((q) => q.lt(q.field("createdAt"), tenMinutesAgo))
      .collect();

    const processingEntries = await ctx.db
      .query("schoolEntries")
      .withIndex("by_status", (q) => q.eq("processingStatus", "processing"))
      .filter((q) => q.lt(q.field("createdAt"), tenMinutesAgo))
      .collect();

    const stale = [...pendingEntries, ...processingEntries];

    for (const entry of stale) {
      await ctx.db.patch(entry._id, {
        processingStatus: "failed",
        errorMessage: "Processing timed out after 10 minutes",
        processedAt: Date.now(),
      });
    }

    return { expired: stale.length };
  },
});

// Internal mutation: wipe all extracted items and entries for a fresh re-process
export const cleanAllData = internalMutation({
  args: {},
  handler: async (ctx) => {
    let count = 0;
    for (const table of [
      "homeworkItems",
      "classworkItems",
      "examItems",
      "schoolEntries",
    ] as const) {
      const rows = await ctx.db.query(table).collect();
      for (const row of rows) {
        await ctx.db.delete(row._id);
        count++;
      }
    }
    return { deleted: count };
  },
});

// Internal mutation: clear extracted items and reset entries for re-processing
export const resetForReprocess = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Delete all extracted items (they'll be re-created from PDFs)
    let deleted = 0;
    for (const table of ["homeworkItems", "classworkItems", "examItems"] as const) {
      const rows = await ctx.db.query(table).collect();
      for (const row of rows) {
        await ctx.db.delete(row._id);
        deleted++;
      }
    }

    // Reset all completed/failed entries to "pending" for re-processing
    const entries = await ctx.db.query("schoolEntries").collect();
    const reset: string[] = [];
    for (const entry of entries) {
      if (entry.processingStatus === "complete" || entry.processingStatus === "failed" || entry.processingStatus === "low_confidence") {
        await ctx.db.patch(entry._id, {
          processingStatus: "pending",
          extractionConfidence: undefined,
          rawExtractedJson: undefined,
          errorMessage: undefined,
          retryCount: 0,
          processedAt: undefined,
        });
        reset.push(entry._id);
      }
    }

    return { deletedItems: deleted, resetEntries: reset.length };
  },
});

// Internal mutation: delete failed entries (cleanup)
export const deleteFailedEntries = internalMutation({
  args: {},
  handler: async (ctx) => {
    const failed = await ctx.db
      .query("schoolEntries")
      .withIndex("by_status", (q) => q.eq("processingStatus", "failed"))
      .collect();

    for (const entry of failed) {
      await ctx.db.delete(entry._id);
    }

    const lowConf = await ctx.db
      .query("schoolEntries")
      .withIndex("by_status", (q) =>
        q.eq("processingStatus", "low_confidence")
      )
      .collect();

    for (const entry of lowConf) {
      await ctx.db.delete(entry._id);
    }

    return { deleted: failed.length + lowConf.length };
  },
});

import { mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { internal } from "./_generated/api";

// Step 1: Generate a short-lived upload URL for the browser
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthenticated");
    return await ctx.storage.generateUploadUrl();
  },
});

// Step 2: After the browser uploads the file, create the entry and kick off processing
export const createEntryFromUpload = mutation({
  args: {
    childId: v.id("children"),
    fileName: v.string(),
    storageId: v.id("_storage"),
    extractedText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new ConvexError("User not found");

    // Verify this child belongs to the user
    const child = await ctx.db.get(args.childId);
    if (!child) throw new ConvexError("Child not found");
    if (child.parentId !== user._id) throw new ConvexError("Access denied");

    const entryDate = new Date().toISOString().split("T")[0];

    // Dedup: only skip if same file was already SUCCESSFULLY processed today.
    // Allow re-uploads for failed, stuck (pending/processing > 5 min), or new files.
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const existingEntries = await ctx.db
      .query("schoolEntries")
      .withIndex("by_childId", (q) => q.eq("childId", args.childId))
      .filter((q) =>
        q.and(
          q.eq(q.field("fileName"), args.fileName),
          q.eq(q.field("entryDate"), entryDate)
        )
      )
      .collect();

    // Only block if there's a completed entry or a recently-started active one
    const blocking = existingEntries.find((e) =>
      e.processingStatus === "complete" ||
      ((e.processingStatus === "pending" || e.processingStatus === "processing") &&
        e.createdAt > fiveMinutesAgo)
    );

    if (blocking) {
      // Delete the uploaded file since we won't use it
      await ctx.storage.delete(args.storageId);
      return blocking._id; // Return existing entry instead of creating duplicate
    }

    // Clean up old failed/stuck entries for this filename so they don't pile up
    for (const old of existingEntries) {
      if (old.processingStatus === "failed" || old.createdAt <= fiveMinutesAgo) {
        await ctx.db.patch(old._id, {
          processingStatus: "failed",
          errorMessage: "Superseded by re-upload",
          processedAt: Date.now(),
        });
      }
    }

    const entryId = await ctx.db.insert("schoolEntries", {
      childId: args.childId,
      parentId: user._id,
      fileStorageId: args.storageId,
      fileName: args.fileName,
      entryDate,
      extractedText: args.extractedText,
      processingStatus: "pending",
      createdAt: Date.now(),
    });

    // Schedule processing with pre-extracted text if available
    await ctx.scheduler.runAfter(0, internal.processEntry.processEntry, {
      entryId,
      extractedText: args.extractedText,
    });

    return entryId;
  },
});

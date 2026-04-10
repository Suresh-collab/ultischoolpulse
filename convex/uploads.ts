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

    // Dedup: skip if same file already successfully processed for this child today
    const existing = await ctx.db
      .query("schoolEntries")
      .withIndex("by_childId", (q) => q.eq("childId", args.childId))
      .filter((q) =>
        q.and(
          q.eq(q.field("fileName"), args.fileName),
          q.eq(q.field("entryDate"), entryDate),
          q.or(
            q.eq(q.field("processingStatus"), "complete"),
            q.eq(q.field("processingStatus"), "pending"),
            q.eq(q.field("processingStatus"), "processing")
          )
        )
      )
      .first();

    if (existing) {
      // Delete the uploaded file since we won't use it
      await ctx.storage.delete(args.storageId);
      return existing._id; // Return existing entry instead of creating duplicate
    }

    const entryId = await ctx.db.insert("schoolEntries", {
      childId: args.childId,
      parentId: user._id,
      fileStorageId: args.storageId,
      fileName: args.fileName,
      entryDate,
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

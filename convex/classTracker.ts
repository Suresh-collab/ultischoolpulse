import { query } from "./_generated/server";
import { v, ConvexError } from "convex/values";

// Helper: verify the child belongs to the authenticated user
async function verifyChildOwnership(
  ctx: any,
  childId: any
): Promise<void> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError("Unauthenticated");

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q: any) => q.eq("clerkId", identity.subject))
    .unique();
  if (!user) throw new ConvexError("User not found");

  const child = await ctx.db.get(childId);
  if (!child) throw new ConvexError("Child not found");

  if (
    child.parentId !== user._id &&
    !child.tutorIds?.includes(user._id)
  ) {
    throw new ConvexError("Access denied");
  }
}

// Daily Class Log: all classwork items for a child, sorted by date desc
export const dailyClassLog = query({
  args: {
    childId: v.id("children"),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await verifyChildOwnership(ctx, args.childId);

    let items = await ctx.db
      .query("classworkItems")
      .withIndex("by_childId_and_date")
      .filter((q: any) => q.eq(q.field("childId"), args.childId))
      .collect();

    // Filter by date range if provided
    if (args.startDate) {
      items = items.filter((i) => i.entryDate >= args.startDate!);
    }
    if (args.endDate) {
      items = items.filter((i) => i.entryDate <= args.endDate!);
    }

    // Sort by date descending, then subject
    items.sort((a, b) => {
      if (a.entryDate !== b.entryDate) return b.entryDate.localeCompare(a.entryDate);
      return a.subject.localeCompare(b.subject);
    });

    return items;
  },
});

// All homework for a child (for the full tracker view)
export const allHomework = query({
  args: {
    childId: v.id("children"),
  },
  handler: async (ctx, args) => {
    await verifyChildOwnership(ctx, args.childId);

    const items = await ctx.db
      .query("homeworkItems")
      .withIndex("by_childId_and_dueDate")
      .filter((q: any) => q.eq(q.field("childId"), args.childId))
      .collect();

    // Sort by assigned date descending
    items.sort((a, b) => b.assignedDate.localeCompare(a.assignedDate));

    return items;
  },
});

// All exams for a child (for the tracker view)
export const allExams = query({
  args: {
    childId: v.id("children"),
  },
  handler: async (ctx, args) => {
    await verifyChildOwnership(ctx, args.childId);

    const items = await ctx.db
      .query("examItems")
      .withIndex("by_childId_and_examDate")
      .filter((q: any) => q.eq(q.field("childId"), args.childId))
      .collect();

    // Sort by exam date descending
    items.sort((a, b) => b.examDate.localeCompare(a.examDate));

    return items;
  },
});
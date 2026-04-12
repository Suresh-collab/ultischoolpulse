import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";

// Helper: verify the child belongs to the authenticated user
async function verifyChildOwnership(
  ctx: any,
  childId: any
): Promise<{ parentId: any }> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError("Unauthenticated");

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkId")
    .filter((q: any) => q.eq(q.field("clerkId"), identity.subject))
    .unique();
  if (!user) throw new ConvexError("User not found");

  const child = await ctx.db.get(childId);
  if (!child) throw new ConvexError("Child not found");

  // Check ownership: parent or linked tutor
  if (
    child.parentId !== user._id &&
    !child.tutorIds?.includes(user._id)
  ) {
    throw new ConvexError("Access denied");
  }

  return { parentId: user._id };
}

export const forChildToday = query({
  args: {
    childId: v.id("children"),
    date: v.string(), // "YYYY-MM-DD"
  },
  handler: async (ctx, args) => {
    await verifyChildOwnership(ctx, args.childId);

    return await ctx.db
      .query("homeworkItems")
      .withIndex("by_childId_and_dueDate")
      .filter((q: any) =>
        q.and(
          q.eq(q.field("childId"), args.childId),
          q.eq(q.field("dueDate"), args.date)
        )
      )
      .collect();
  },
});

export const forChildThisWeek = query({
  args: {
    childId: v.id("children"),
    weekStart: v.string(), // "YYYY-MM-DD" (Monday)
    weekEnd: v.string(), // "YYYY-MM-DD" (Sunday)
  },
  handler: async (ctx, args) => {
    await verifyChildOwnership(ctx, args.childId);

    return await ctx.db
      .query("homeworkItems")
      .withIndex("by_childId_and_dueDate")
      .filter((q: any) =>
        q.and(
          q.eq(q.field("childId"), args.childId),
          q.gte(q.field("dueDate"), args.weekStart),
          q.lte(q.field("dueDate"), args.weekEnd)
        )
      )
      .collect();
  },
});

// All homework for a child (pending + completed) in a date range
export const allForChild = query({
  args: {
    childId: v.id("children"),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    await verifyChildOwnership(ctx, args.childId);

    return await ctx.db
      .query("homeworkItems")
      .withIndex("by_childId_and_dueDate")
      .filter((q: any) =>
        q.and(
          q.eq(q.field("childId"), args.childId),
          q.gte(q.field("dueDate"), args.startDate),
          q.lte(q.field("dueDate"), args.endDate)
        )
      )
      .collect();
  },
});

export const markComplete = mutation({
  args: {
    homeworkId: v.id("homeworkItems"),
    isComplete: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthenticated");

    const homework = await ctx.db.get(args.homeworkId);
    if (!homework) throw new ConvexError("Homework item not found");

    await ctx.db.patch(args.homeworkId, {
      isComplete: args.isComplete,
      completedAt: args.isComplete ? Date.now() : undefined,
    });
  },
});

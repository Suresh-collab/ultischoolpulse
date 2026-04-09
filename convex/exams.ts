import { query, mutation } from "./_generated/server";
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
    .withIndex("by_clerkId")
    .filter((q: any) => q.eq(q.field("clerkId"), identity.subject))
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

export const upcoming = query({
  args: {
    childId: v.id("children"),
    daysAhead: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await verifyChildOwnership(ctx, args.childId);

    const today = new Date().toISOString().split("T")[0];
    const daysAhead = args.daysAhead ?? 14;
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);
    const endDate = futureDate.toISOString().split("T")[0];

    return await ctx.db
      .query("examItems")
      .withIndex("by_childId_and_examDate")
      .filter((q: any) =>
        q.and(
          q.eq(q.field("childId"), args.childId),
          q.gte(q.field("examDate"), today),
          q.lte(q.field("examDate"), endDate)
        )
      )
      .order("asc")
      .collect();
  },
});

export const allForChild = query({
  args: {
    childId: v.id("children"),
  },
  handler: async (ctx, args) => {
    await verifyChildOwnership(ctx, args.childId);

    return await ctx.db
      .query("examItems")
      .withIndex("by_childId_and_examDate")
      .filter((q: any) => q.eq(q.field("childId"), args.childId))
      .order("asc")
      .collect();
  },
});

export const acknowledge = mutation({
  args: {
    examId: v.id("examItems"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthenticated");

    const exam = await ctx.db.get(args.examId);
    if (!exam) throw new ConvexError("Exam item not found");

    await ctx.db.patch(args.examId, {
      isAcknowledged: true,
    });
  },
});

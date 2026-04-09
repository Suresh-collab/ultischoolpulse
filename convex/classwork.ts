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

export const forChildThisWeek = query({
  args: {
    childId: v.id("children"),
    weekStart: v.string(), // "YYYY-MM-DD" (Monday)
    weekEnd: v.string(), // "YYYY-MM-DD" (Sunday)
  },
  handler: async (ctx, args) => {
    await verifyChildOwnership(ctx, args.childId);

    return await ctx.db
      .query("classworkItems")
      .withIndex("by_childId_and_date")
      .filter((q: any) =>
        q.and(
          q.eq(q.field("childId"), args.childId),
          q.gte(q.field("entryDate"), args.weekStart),
          q.lte(q.field("entryDate"), args.weekEnd)
        )
      )
      .collect();
  },
});

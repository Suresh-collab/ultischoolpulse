import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return [];

    return await ctx.db
      .query("children")
      .withIndex("by_parentId", (q) => q.eq("parentId", user._id))
      .collect();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    schoolName: v.string(),
    grade: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new ConvexError("User not found");

    if (user.role !== "parent") {
      throw new ConvexError("Only parents can add children");
    }

    return await ctx.db.insert("children", {
      parentId: user._id,
      name: args.name,
      schoolName: args.schoolName,
      grade: args.grade,
      tutorIds: [],
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    childId: v.id("children"),
    name: v.optional(v.string()),
    schoolName: v.optional(v.string()),
    grade: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new ConvexError("User not found");

    const child = await ctx.db.get(args.childId);
    if (!child) throw new ConvexError("Child not found");
    if (child.parentId !== user._id) throw new ConvexError("Access denied");

    const updates: Record<string, string | undefined> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.schoolName !== undefined) updates.schoolName = args.schoolName;
    if (args.grade !== undefined) updates.grade = args.grade;

    await ctx.db.patch(args.childId, updates);
  },
});

export const addTutor = mutation({
  args: {
    childId: v.id("children"),
    tutorEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new ConvexError("User not found");

    const child = await ctx.db.get(args.childId);
    if (!child) throw new ConvexError("Child not found");
    if (child.parentId !== user._id) throw new ConvexError("Access denied");

    // Look up tutor by email
    const tutor = await ctx.db
      .query("users")
      .filter((q) =>
        q.and(
          q.eq(q.field("email"), args.tutorEmail),
          q.eq(q.field("role"), "tutor")
        )
      )
      .unique();

    if (tutor) {
      // Tutor exists — add to tutorIds if not already linked
      if (!child.tutorIds.includes(tutor._id)) {
        await ctx.db.patch(args.childId, {
          tutorIds: [...child.tutorIds, tutor._id],
        });
      }
      return { status: "linked" as const };
    }

    // Tutor not found — stub for invite (will be implemented in Phase 3)
    // TODO: Send invite email via Resend
    return { status: "invite_pending" as const };
  },
});

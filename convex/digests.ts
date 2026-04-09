import { internalAction, internalQuery, internalMutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { Resend } from "resend";
import { render } from "@react-email/render";
import { DailyDigestEmail } from "../src/lib/email-templates/daily-digest";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

// Query: list parents eligible for digest at a given time
export const getEligibleParents = internalQuery({
  args: {
    digestTime: v.string(), // "morning" | "evening"
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .filter((q: any) =>
        q.and(
          q.eq(q.field("role"), "parent"),
          q.eq(q.field("digestEnabled"), true),
          q.eq(q.field("digestTime"), args.digestTime)
        )
      )
      .collect();
  },
});

// Cron entry point: fan out individual digests for eligible parents
export const sendScheduledDigests = internalAction({
  args: {
    digestTime: v.string(),
  },
  handler: async (ctx, args) => {
    const parents = await ctx.runQuery(internal.digests.getEligibleParents, {
      digestTime: args.digestTime,
    });

    // Fan out: schedule each parent's digest as a separate action
    for (const parent of parents) {
      await ctx.scheduler.runAfter(0, internal.digests.sendForParent, {
        parentId: parent._id,
      });
    }
  },
});

// Action: send digest for a single parent
export const sendForParent = internalAction({
  args: {
    parentId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Fetch parent
    const parent = await ctx.runQuery(internal.digests.getParentById, {
      parentId: args.parentId,
    });
    if (!parent || !parent.digestEnabled) return;

    // Fetch children
    const children = await ctx.runQuery(internal.digests.getChildrenForParent, {
      parentId: args.parentId,
    });
    if (children.length === 0) return;

    const today = new Date().toISOString().split("T")[0];
    const sevenDaysOut = new Date();
    sevenDaysOut.setDate(sevenDaysOut.getDate() + 7);
    const endDate = sevenDaysOut.toISOString().split("T")[0];

    // Gather data for each child
    const childDigests = await Promise.all(
      children.map(async (child) => {
        const homework = await ctx.runQuery(
          internal.digests.getHomeworkForDigest,
          { childId: child._id, date: today }
        );
        const exams = await ctx.runQuery(
          internal.digests.getExamsForDigest,
          { childId: child._id, today, endDate }
        );

        return {
          childName: child.name,
          homework: homework.map((h) => ({
            subject: h.subject,
            description: h.description,
            dueDate: h.dueDate,
          })),
          exams: exams.map((e) => ({
            subject: e.subject,
            examType: e.examType,
            examDate: e.examDate,
            portions: e.portions,
          })),
        };
      })
    );

    const totalItems = childDigests.reduce(
      (sum, c) => sum + c.homework.length + c.exams.length,
      0
    );

    // Format date for email subject/header
    const dateObj = new Date();
    const dayName = dateObj.toLocaleDateString("en-US", { weekday: "long" });
    const dateDisplay = dateObj.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    const appUrl = process.env.APP_URL ?? "https://ultischoolpulse.vercel.app";
    const convexUrl =
      process.env.CONVEX_SITE_URL ?? "https://your-convex-url.convex.site";
    const unsubscribeUrl = `${convexUrl}/unsubscribe?userId=${args.parentId}`;

    // Render email
    const html = await render(
      DailyDigestEmail({
        parentName: parent.name,
        dateDisplay,
        children: childDigests,
        appUrl: `${appUrl}/dashboard`,
        unsubscribeUrl,
      })
    );

    // Determine subject line
    const childNames = children.map((c) => c.name).join(" & ");
    const subject = `${childNames}'s school update for ${dayName}, ${dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

    // Send via Resend
    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail =
      process.env.RESEND_FROM_EMAIL ?? "noreply@ultischoolpulse.com";

    let emailStatus: "sent" | "failed" = "failed";

    if (resendApiKey) {
      try {
        const resend = new Resend(resendApiKey);
        await resend.emails.send({
          from: `ULTISchoolPulse <${fromEmail}>`,
          to: parent.email,
          subject,
          html,
        });
        emailStatus = "sent";
      } catch (err) {
        console.error("Resend send failed:", err);
        emailStatus = "failed";
      }
    } else {
      console.warn("RESEND_API_KEY not set — skipping email send");
      emailStatus = "failed";
    }

    // Log to digestLog
    await ctx.runMutation(internal.digests.logDigest, {
      parentId: args.parentId,
      digestDate: today,
      emailStatus,
      childrenIncluded: children.map((c) => c._id),
      itemCount: totalItems,
    });
  },
});

// Internal queries needed by sendForParent
export const getParentById = internalQuery({
  args: { parentId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.parentId);
  },
});

export const getChildrenForParent = internalQuery({
  args: { parentId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("children")
      .withIndex("by_parentId", (q) => q.eq("parentId", args.parentId))
      .collect();
  },
});

export const getHomeworkForDigest = internalQuery({
  args: { childId: v.id("children"), date: v.string() },
  handler: async (ctx, args) => {
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

export const getExamsForDigest = internalQuery({
  args: {
    childId: v.id("children"),
    today: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("examItems")
      .withIndex("by_childId_and_examDate")
      .filter((q: any) =>
        q.and(
          q.eq(q.field("childId"), args.childId),
          q.gte(q.field("examDate"), args.today),
          q.lte(q.field("examDate"), args.endDate)
        )
      )
      .collect();
  },
});

export const logDigest = internalMutation({
  args: {
    parentId: v.id("users"),
    digestDate: v.string(),
    emailStatus: v.union(v.literal("sent"), v.literal("failed")),
    childrenIncluded: v.array(v.id("children")),
    itemCount: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("digestLog", {
      parentId: args.parentId,
      sentAt: Date.now(),
      digestDate: args.digestDate,
      emailStatus: args.emailStatus,
      childrenIncluded: args.childrenIncluded,
      itemCount: args.itemCount,
    });
  },
});

// Unsubscribe user from digests (called from HTTP action)
export const unsubscribeUser = internalMutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new ConvexError("User not found");

    await ctx.db.patch(args.userId, { digestEnabled: false });
  },
});

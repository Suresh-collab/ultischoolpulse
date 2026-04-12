import { internalAction, internalQuery, internalMutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { Resend } from "resend";
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

    // Render email as plain HTML (no JSX in Convex runtime)
    const html = buildDigestHtml({
      parentName: parent.name,
      dateDisplay,
      childDigests,
      dashboardUrl: `${appUrl}/dashboard`,
      unsubscribeUrl,
    });

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

// HTML email builder (no JSX/React dependencies)
type DigestChild = {
  childName: string;
  homework: { subject: string; description: string; dueDate: string }[];
  exams: { subject: string; examType: string; examDate: string; portions: string[] }[];
};

function buildDigestHtml(opts: {
  parentName: string;
  dateDisplay: string;
  childDigests: DigestChild[];
  dashboardUrl: string;
  unsubscribeUrl: string;
}): string {
  const { parentName, dateDisplay, childDigests, dashboardUrl, unsubscribeUrl } = opts;
  const hasContent = childDigests.some(c => c.homework.length > 0 || c.exams.length > 0);

  const childSections = childDigests.map(child => {
    const hwBySubject = new Map<string, string[]>();
    for (const h of child.homework) {
      const list = hwBySubject.get(h.subject) ?? [];
      list.push(`${h.description}${h.dueDate ? ` (due ${h.dueDate})` : ""}`);
      hwBySubject.set(h.subject, list);
    }

    const hwHtml = child.homework.length > 0
      ? `<p style="font-size:13px;font-weight:600;color:#0F7B6C;text-transform:uppercase;letter-spacing:0.5px;margin:12px 0 8px">Homework</p>` +
        Array.from(hwBySubject.entries()).map(([subj, items]) =>
          `<p style="font-size:14px;font-weight:600;color:#111827;margin:0 0 4px">${subj}</p>` +
          items.map(i => `<p style="font-size:14px;color:#374151;margin:2px 0 2px 8px">&bull; ${i}</p>`).join("")
        ).join("")
      : `<p style="font-size:14px;color:#9CA3AF;font-style:italic;margin:4px 0">No homework today.</p>`;

    const examHtml = child.exams.length > 0
      ? `<p style="font-size:13px;font-weight:600;color:#0F7B6C;text-transform:uppercase;letter-spacing:0.5px;margin:12px 0 8px">Upcoming Exams (7 days)</p>` +
        child.exams.map(e =>
          `<div style="margin-bottom:8px;padding-left:8px;border-left:3px solid #F59F00">` +
          `<p style="font-size:14px;font-weight:600;color:#111827;margin:0 0 2px">${e.subject} — ${e.examType} on ${e.examDate}</p>` +
          (e.portions.length > 0 ? `<p style="font-size:13px;color:#6B7280;margin:0">Portions: ${e.portions.join(", ")}</p>` : "") +
          `</div>`
        ).join("")
      : "";

    return `<h2 style="font-size:18px;font-weight:600;color:#111827;margin:0 0 12px">${child.childName}</h2>${hwHtml}${examHtml}`;
  }).join(`<hr style="border-color:#E5E7EB;margin:16px 0">`);

  const bodyContent = hasContent
    ? childSections
    : `<p style="font-size:14px;color:#6B7280;line-height:1.5">All clear today — no homework or exams on record. Enjoy the break!</p>`;

  return `<!DOCTYPE html><html><head></head><body style="background-color:#F8FAFA;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:0">
<div style="margin:0 auto;max-width:560px">
  <div style="background-color:#0F7B6C;padding:24px 32px;border-radius:12px 12px 0 0">
    <p style="color:#fff;font-size:20px;font-weight:700;margin:0">ULTISchoolPulse</p>
    <p style="color:#E6F4F2;font-size:14px;margin:4px 0 0">${dateDisplay}</p>
  </div>
  <div style="background-color:#fff;padding:24px 32px">
    <p style="font-size:16px;color:#111827;margin:0 0 16px">Hi ${parentName},</p>
    ${bodyContent}
    <div style="text-align:center;margin-top:24px">
      <a href="${dashboardUrl}" style="background-color:#0F7B6C;color:#fff;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;display:inline-block">Open Dashboard</a>
    </div>
  </div>
  <div style="background-color:#F8FAFA;padding:16px 32px;border-radius:0 0 12px 12px;text-align:center">
    <p style="font-size:12px;color:#9CA3AF;margin:4px 0"><a href="${unsubscribeUrl}" style="color:#6B7280;text-decoration:underline">Unsubscribe</a> from daily digest emails</p>
    <p style="font-size:12px;color:#9CA3AF;margin:4px 0">ULTISchoolPulse — Stop reading PDFs, start knowing what matters.</p>
  </div>
</div>
</body></html>`;
}

import { httpAction } from "./_generated/server";
import { httpRouter } from "convex/server";
import { api, internal } from "./_generated/api";

const http = httpRouter();

http.route({
  path: "/ingest-pdf",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // 1. Validate auth header
    const authHeader = request.headers.get("Authorization");
    const deployKey = process.env.CONVEX_DEPLOY_KEY;
    if (!deployKey || authHeader !== `Bearer ${deployKey}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2. Parse FormData
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid FormData request body" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const childId = formData.get("childId") as string | null;
    const fileName = formData.get("fileName") as string | null;
    const fileContent = formData.get("fileContent") as string | null;

    if (!childId || !fileName || !fileContent) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: childId, fileName, fileContent",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 3. Decode base64 and store PDF in Convex file storage
    let pdfBuffer: ArrayBuffer;
    try {
      const binaryString = atob(fileContent);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      pdfBuffer = bytes.buffer;
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid base64 fileContent" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const blob = new Blob([pdfBuffer], { type: "application/pdf" });
    const storageId = await ctx.storage.store(blob);

    // 4. Create schoolEntry record and schedule processing
    const entryDate = new Date().toISOString().split("T")[0];

    const entryId = await ctx.runMutation(
      internal.schoolEntries.createEntry,
      {
        childId,
        fileName,
        fileStorageId: storageId,
        entryDate,
      }
    );

    // 5. Schedule processing
    await ctx.scheduler.runAfter(
      0,
      internal.processEntry.processEntry,
      { entryId }
    );

    return new Response(
      JSON.stringify({ entryId, status: "queued" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }),
});

// Unsubscribe from digest emails
http.route({
  path: "/unsubscribe",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId");

    if (!userId) {
      return new Response("Missing userId parameter", { status: 400 });
    }

    try {
      await ctx.runMutation(internal.digests.unsubscribeUser, {
        userId: userId as any,
      });

      return new Response(
        `<!DOCTYPE html>
<html>
<head><title>Unsubscribed</title></head>
<body style="font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#F8FAFA">
  <div style="text-align:center;padding:40px">
    <h1 style="color:#0F7B6C;margin-bottom:8px">Unsubscribed</h1>
    <p style="color:#6B7280">You won't receive any more digest emails from ULTISchoolPulse.</p>
    <p style="color:#9CA3AF;font-size:14px">You can re-enable digests anytime in Settings.</p>
  </div>
</body>
</html>`,
        { status: 200, headers: { "Content-Type": "text/html" } }
      );
    } catch {
      return new Response("Something went wrong", { status: 500 });
    }
  }),
});

// Accept tutor invite — links tutor to child after signup
http.route({
  path: "/accept-tutor-invite",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response("Missing token", { status: 400 });
    }

    try {
      await ctx.runMutation(internal.children.acceptTutorInvite, { token });

      return new Response(
        `<!DOCTYPE html>
<html>
<head><title>Invite Accepted</title></head>
<body style="font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#F8FAFA">
  <div style="text-align:center;padding:40px">
    <h1 style="color:#0F7B6C;margin-bottom:8px">You're linked!</h1>
    <p style="color:#6B7280">You can now see this student's classwork and exams in your tutor dashboard.</p>
    <a href="/" style="color:#0F7B6C;text-decoration:underline;font-size:14px">Go to ULTISchoolPulse</a>
  </div>
</body>
</html>`,
        { status: 200, headers: { "Content-Type": "text/html" } }
      );
    } catch {
      return new Response("Invalid or expired invite link", { status: 400 });
    }
  }),
});

export default http;

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
      internal.schoolEntries.processEntry,
      { entryId }
    );

    return new Response(
      JSON.stringify({ entryId, status: "queued" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }),
});

export default http;

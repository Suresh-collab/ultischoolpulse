import fs from "node:fs";
import path from "node:path";

const CONVEX_HTTP_ACTION_URL = process.env.CONVEX_HTTP_ACTION_URL!;
const CONVEX_DEPLOY_KEY = process.env.CONVEX_DEPLOY_KEY!;
const DEFAULT_CHILD_ID = process.env.DEFAULT_CHILD_ID!;

export async function uploadPdf(filePath: string): Promise<boolean> {
  const fileName = path.basename(filePath);

  let fileBuffer: Buffer;
  try {
    fileBuffer = fs.readFileSync(filePath);
  } catch (err) {
    console.error(`[upload] Failed to read file: ${filePath}`, err);
    return false;
  }

  if (fileBuffer.length === 0) {
    console.warn(`[upload] Skipping empty file: ${fileName}`);
    return false;
  }

  const base64Content = fileBuffer.toString("base64");

  const formData = new FormData();
  formData.append("childId", DEFAULT_CHILD_ID);
  formData.append("fileName", fileName);
  formData.append("fileContent", base64Content);

  try {
    const response = await fetch(CONVEX_HTTP_ACTION_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CONVEX_DEPLOY_KEY}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[upload] HTTP ${response.status} for ${fileName}: ${errorText}`
      );
      return false;
    }

    const result = await response.json();
    console.log(
      `[upload] Queued ${fileName} → entryId: ${result.entryId}, status: ${result.status}`
    );
    return true;
  } catch (err) {
    console.error(`[upload] Network error uploading ${fileName}:`, err);
    return false;
  }
}

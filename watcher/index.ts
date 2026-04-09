import "dotenv/config";
import chokidar from "chokidar";
import path from "node:path";
import { uploadPdf } from "./upload.js";

const WATCHED_FOLDER_PATH = process.env.WATCHED_FOLDER_PATH;

if (!WATCHED_FOLDER_PATH) {
  console.error(
    "[watcher] WATCHED_FOLDER_PATH is not set. Please configure it in .env"
  );
  process.exit(1);
}

if (!process.env.CONVEX_HTTP_ACTION_URL) {
  console.error("[watcher] CONVEX_HTTP_ACTION_URL is not set.");
  process.exit(1);
}

if (!process.env.CONVEX_DEPLOY_KEY) {
  console.error("[watcher] CONVEX_DEPLOY_KEY is not set.");
  process.exit(1);
}

if (!process.env.DEFAULT_CHILD_ID) {
  console.error("[watcher] DEFAULT_CHILD_ID is not set.");
  process.exit(1);
}

// Track files already processed today to avoid duplicates
const processedToday = new Set<string>();

function getTodayKey(fileName: string): string {
  const today = new Date().toISOString().split("T")[0];
  return `${today}:${fileName}`;
}

async function handlePdf(filePath: string) {
  const fileName = path.basename(filePath);

  // Only process .pdf files
  if (!fileName.toLowerCase().endsWith(".pdf")) return;

  const key = getTodayKey(fileName);
  if (processedToday.has(key)) {
    console.log(`[watcher] Skipping already-processed: ${fileName}`);
    return;
  }

  console.log(`[watcher] Detected PDF: ${fileName}`);
  const success = await uploadPdf(filePath);

  if (success) {
    processedToday.add(key);
  }
}

// Start watching
console.log(`[watcher] Monitoring folder: ${WATCHED_FOLDER_PATH}`);
console.log("[watcher] Scanning for existing PDFs...");

const watcher = chokidar.watch(WATCHED_FOLDER_PATH, {
  ignoreInitial: false, // Process existing files on startup
  persistent: true,
  awaitWriteFinish: {
    stabilityThreshold: 1000,
    pollInterval: 200,
  },
});

watcher.on("add", (filePath) => {
  handlePdf(filePath);
});

watcher.on("error", (error) => {
  console.error("[watcher] Error:", error);
});

watcher.on("ready", () => {
  console.log("[watcher] Initial scan complete. Watching for new PDFs...");
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n[watcher] Shutting down...");
  watcher.close().then(() => process.exit(0));
});

#!/usr/bin/env npx tsx
/**
 * Upload existing local document files to S3-compatible storage.
 *
 * Preserves storageKey paths relative to LOCAL_DOCUMENT_STORAGE_ROOT (default .data/documents).
 *
 * Usage:
 *   DOCUMENT_STORAGE_BACKEND=s3 \
 *   S3_BUCKET=... S3_REGION=... S3_ACCESS_KEY_ID=... S3_SECRET_ACCESS_KEY=... \
 *   [S3_ENDPOINT=...] [S3_FORCE_PATH_STYLE=true] \
 *   npx tsx scripts/migrate-documents-to-s3.ts
 *
 * Optional:
 *   LOCAL_DOCUMENT_STORAGE_ROOT=.data/documents
 *   DRY_RUN=true   — list files only, no upload
 */

import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { getLocalDocumentStorageRoot } from "@/lib/storage/local-document-storage";
import { createS3DocumentStorage, readS3DocumentStorageEnv } from "@/lib/storage/s3-document-storage";

async function walkFiles(dir: string, baseDir: string): Promise<{ storageKey: string; filePath: string }[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: { storageKey: string; filePath: string }[] = [];

  for (const entry of entries) {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(filePath, baseDir)));
      continue;
    }
    if (!entry.isFile()) continue;

    const relative = path.relative(baseDir, filePath).split(path.sep).join("/");
    files.push({ storageKey: relative, filePath });
  }

  return files;
}

function guessContentType(fileName: string): string {
  if (fileName.endsWith(".pdf")) return "application/pdf";
  if (fileName.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}

async function main() {
  const dryRun = process.env.DRY_RUN === "true";
  const root = getLocalDocumentStorageRoot();

  let rootStat;
  try {
    rootStat = await stat(root);
  } catch {
    console.error(`Local document root not found: ${root}`);
    process.exit(1);
  }

  if (!rootStat.isDirectory()) {
    console.error(`Local document root is not a directory: ${root}`);
    process.exit(1);
  }

  const files = await walkFiles(root, root);
  console.log(`Found ${files.length} file(s) under ${root}`);

  if (files.length === 0) {
    console.log("Nothing to migrate.");
    return;
  }

  if (dryRun) {
    for (const file of files) {
      console.log(`DRY_RUN would upload: ${file.storageKey}`);
    }
    return;
  }

  const config = readS3DocumentStorageEnv();
  const storage = createS3DocumentStorage(config);

  for (const file of files) {
    const bytes = new Uint8Array(await readFile(file.filePath));
    const contentType = guessContentType(file.filePath);
    await storage.writeDocument(file.storageKey, bytes, contentType);
    console.log(`Uploaded ${file.storageKey} (${bytes.length} bytes)`);
  }

  console.log(`Migration complete. ${files.length} object(s) uploaded to bucket ${config.bucket}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

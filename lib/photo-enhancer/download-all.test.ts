import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { unzipSync } from "fflate";
import { enhancedDownloadFileName } from "./prepare-upload";
import {
  ENHANCED_PHOTOS_ZIP_NAME,
  canDownloadAllEnhancedPhotos,
  collectEnhancedZipFiles,
  createEnhancedPhotosZip,
  downloadEnhancedPhotosZip,
  uniqueEnhancedZipName,
  type EnhancedZipPhoto,
} from "./download-all";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

function pngBytes(label: string): Uint8Array {
  const header = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const body = new TextEncoder().encode(label);
  const bytes = new Uint8Array(header.length + body.length);
  bytes.set(header);
  bytes.set(body, header.length);
  return bytes;
}

function photo(
  status: EnhancedZipPhoto["status"],
  downloadName: string,
  pngBytesValue: Uint8Array | null,
): EnhancedZipPhoto {
  return { status, downloadName, pngBytes: pngBytesValue };
}

function sliceFunction(source: string, name: string): string {
  const start = source.indexOf(`async function ${name}`);
  assert.ok(start >= 0, `missing ${name}`);
  const rest = source.slice(start + 1);
  const next = rest.search(/\n  (?:async )?function /);
  assert.ok(next >= 0, `unterminated ${name}`);
  return source.slice(start, start + 1 + next);
}

describe("Download All enhanced PNGs", () => {
  it("is unavailable when no photo is complete", () => {
    const photos = [
      photo("waiting", "kitchen-enhanced.png", null),
      photo("enhancing", "bath-enhanced.png", pngBytes("still-running")),
      photo("failed", "living-enhanced.png", null),
      photo("complete", "empty-enhanced.png", new Uint8Array()),
    ];
    assert.equal(canDownloadAllEnhancedPhotos(photos), false);
    assert.equal(createEnhancedPhotosZip(photos), null);
    assert.deepEqual(collectEnhancedZipFiles(photos), []);
  });

  it("packages one completed enhanced PNG and keeps the individual download name", () => {
    const downloadName = enhancedDownloadFileName("kitchen.jpg");
    const enhanced = pngBytes("kitchen-enhanced");
    const zip = createEnhancedPhotosZip([photo("complete", downloadName, enhanced)]);

    assert.ok(zip);
    assert.equal(downloadName, "kitchen-enhanced.png");
    assert.equal(zip.fileName, ENHANCED_PHOTOS_ZIP_NAME);
    assert.deepEqual(zip.entryNames, ["kitchen-enhanced.png"]);

    const entries = unzipSync(zip.bytes);
    assert.deepEqual(Object.keys(entries), ["kitchen-enhanced.png"]);
    assert.deepEqual(entries["kitchen-enhanced.png"], enhanced);
  });

  it("includes every completed enhanced PNG and excludes originals", () => {
    const kitchenEnhanced = pngBytes("kitchen-out");
    const livingEnhanced = pngBytes("living-out");
    const kitchenOriginal = pngBytes("kitchen-original");
    const zip = createEnhancedPhotosZip([
      photo("complete", "kitchen-enhanced.png", kitchenEnhanced),
      photo("complete", "living-room-enhanced.png", livingEnhanced),
    ]);

    assert.ok(zip);
    const entries = unzipSync(zip.bytes);
    assert.deepEqual(Object.keys(entries).sort(), ["kitchen-enhanced.png", "living-room-enhanced.png"]);
    assert.deepEqual(entries["kitchen-enhanced.png"], kitchenEnhanced);
    assert.deepEqual(entries["living-room-enhanced.png"], livingEnhanced);
    assert.equal(entries["kitchen.jpg"], undefined);
    assert.equal(Buffer.from(zip.bytes).includes(Buffer.from(kitchenOriginal)), false);
  });

  it("excludes waiting, enhancing, and failed photos even when bytes are present", () => {
    const completed = pngBytes("done");
    const zip = createEnhancedPhotosZip([
      photo("waiting", "waiting-enhanced.png", pngBytes("waiting")),
      photo("enhancing", "enhancing-enhanced.png", pngBytes("enhancing")),
      photo("failed", "failed-enhanced.png", pngBytes("failed")),
      photo("complete", "done-enhanced.png", completed),
    ]);

    assert.ok(zip);
    const entries = unzipSync(zip.bytes);
    assert.deepEqual(Object.keys(entries), ["done-enhanced.png"]);
    assert.deepEqual(entries["done-enhanced.png"], completed);
  });

  it("suffixes duplicate enhanced filenames without overwriting", () => {
    const used = new Set<string>();
    assert.equal(uniqueEnhancedZipName("kitchen-enhanced.png", used), "kitchen-enhanced.png");
    assert.equal(uniqueEnhancedZipName("kitchen-enhanced.png", used), "kitchen-enhanced-2.png");
    assert.equal(uniqueEnhancedZipName("kitchen-enhanced-2.png", used), "kitchen-enhanced-2-2.png");

    const first = pngBytes("first");
    const second = pngBytes("second");
    const third = pngBytes("third");
    const zip = createEnhancedPhotosZip([
      photo("complete", "kitchen-enhanced.png", first),
      photo("complete", "kitchen-enhanced.png", second),
      photo("complete", "kitchen-enhanced-2.png", third),
    ]);

    assert.ok(zip);
    assert.deepEqual(zip.entryNames, [
      "kitchen-enhanced.png",
      "kitchen-enhanced-2.png",
      "kitchen-enhanced-2-2.png",
    ]);
    const entries = unzipSync(zip.bytes);
    assert.equal(new Set(zip.entryNames).size, zip.entryNames.length);
    assert.deepEqual(entries["kitchen-enhanced.png"], first);
    assert.deepEqual(entries["kitchen-enhanced-2.png"], second);
    assert.deepEqual(entries["kitchen-enhanced-2-2.png"], third);
  });

  it("does not mutate the batch while building the ZIP", () => {
    const completed = pngBytes("done");
    const photos: EnhancedZipPhoto[] = [
      photo("complete", "kitchen-enhanced.png", completed),
      photo("failed", "bath-enhanced.png", pngBytes("failed")),
      photo("waiting", "living-enhanced.png", null),
    ];
    const before = photos.map((item) => ({
      status: item.status,
      downloadName: item.downloadName,
      pngBytes: item.pngBytes ? Array.from(item.pngBytes) : null,
    }));

    const zip = createEnhancedPhotosZip(photos);
    assert.ok(zip);
    assert.deepEqual(
      photos.map((item) => ({
        status: item.status,
        downloadName: item.downloadName,
        pngBytes: item.pngBytes ? Array.from(item.pngBytes) : null,
      })),
      before,
    );
  });

  it("revokes the temporary ZIP object URL after the download starts", () => {
    const revoked: string[] = [];
    let saved: { url: string; fileName: string } | null = null;

    downloadEnhancedPhotosZip(pngBytes("zip"), {
      createObjectURL: () => "blob:zip-1",
      revokeObjectURL: (url) => {
        revoked.push(url);
      },
      save: (url, fileName) => {
        saved = { url, fileName };
      },
    });

    assert.deepEqual(saved, { url: "blob:zip-1", fileName: "enhanced-photos.zip" });
    assert.deepEqual(revoked, ["blob:zip-1"]);
  });

  it("still revokes the temporary ZIP URL when the browser download throws", () => {
    const revoked: string[] = [];
    assert.throws(() => {
      downloadEnhancedPhotosZip(pngBytes("zip"), {
        createObjectURL: () => "blob:zip-2",
        revokeObjectURL: (url) => {
          revoked.push(url);
        },
        save: () => {
          throw new Error("download failed");
        },
      });
    }, /download failed/);
    assert.deepEqual(revoked, ["blob:zip-2"]);
  });
});

describe("photo enhancer download UI boundary", () => {
  it("keeps individual Download PNG and adds Download All without resetting the batch", () => {
    const source = readFileSync(
      join(repoRoot, "components/photo-enhancer/photo-enhancer-panel.tsx"),
      "utf8",
    );
    assert.match(source, /download=\{item\.downloadName\}/);
    assert.match(source, /Download PNG/);
    assert.match(source, /Download All PNGs/);
    const buttonAt = source.indexOf("Download All PNGs");
    assert.match(source.slice(Math.max(0, buttonAt - 240), buttonAt), /completeCount > 0/);
    assert.match(source, /createEnhancedPhotosZip/);
    assert.doesNotMatch(source, /prisma|S3_|documentStorage/);

    const downloadAll = sliceFunction(source, "downloadAllPngs");
    assert.match(downloadAll, /createEnhancedPhotosZip/);
    assert.doesNotMatch(downloadAll, /clearBatch|replaceItems|setItems|runQueue|retryPhoto/);
    assert.doesNotMatch(downloadAll, /\/api\/photo-enhancer\/enhance/);
  });
});

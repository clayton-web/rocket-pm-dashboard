import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import {
  createDocumentStorage,
  getDocumentStorageBackend,
  resetDocumentStorageCache,
} from "@/lib/storage/document-storage";
import { normalizeDocumentStorageKey } from "@/lib/storage/document-storage-keys";
import {
  createLocalDocumentStorage,
  getLocalDocumentStorageRoot,
  resolveLocalDocumentPath,
} from "@/lib/storage/local-document-storage";
import {
  createS3DocumentStorage,
  readS3DocumentStorageEnv,
} from "@/lib/storage/s3-document-storage";
import {
  isProductionDocumentStorageMisconfigured,
  productionDocumentStorageViolationMessage,
} from "@/lib/runtime/document-storage-guards";
import { validateProductionRuntimeConfig } from "@/lib/runtime/production-guards";

const ORIGINAL_ENV = { ...process.env };

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key];
    }
  }
  Object.assign(process.env, ORIGINAL_ENV);
  resetDocumentStorageCache();
}

afterEach(() => {
  restoreEnv();
});

describe("normalizeDocumentStorageKey", () => {
  it("strips leading slashes and removes .. segments", () => {
    assert.equal(normalizeDocumentStorageKey("/org/test/file.pdf"), "org/test/file.pdf");
    assert.equal(normalizeDocumentStorageKey("org/evil..path/file.pdf"), "org/evilpath/file.pdf");
  });
});

describe("createLocalDocumentStorage", () => {
  it("writes and reads bytes round-trip", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "rocket-pm-docs-"));
    process.env.LOCAL_DOCUMENT_STORAGE_ROOT = root;

    try {
      const storage = createLocalDocumentStorage();
      const key = "org/test/property/p/tenancy/t/doc-test.pdf";
      const payload = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

      await storage.writeDocument(key, payload, "application/pdf");
      const read = await storage.readDocument(key);

      assert.deepEqual(Buffer.from(read), Buffer.from(payload));
      const filePath = resolveLocalDocumentPath(key);
      assert.equal(filePath.startsWith(root), true);
      const onDisk = await readFile(filePath);
      assert.deepEqual(new Uint8Array(onDisk), payload);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("getDocumentStorageBackend", () => {
  it("defaults to local when unset", () => {
    delete process.env.DOCUMENT_STORAGE_BACKEND;
    assert.equal(getDocumentStorageBackend(), "local");
  });

  it("accepts explicit local and s3", () => {
    process.env.DOCUMENT_STORAGE_BACKEND = "local";
    assert.equal(getDocumentStorageBackend(), "local");
    process.env.DOCUMENT_STORAGE_BACKEND = "s3";
    assert.equal(getDocumentStorageBackend(), "s3");
  });

  it("rejects unknown backends", () => {
    process.env.DOCUMENT_STORAGE_BACKEND = "azure";
    assert.throws(() => getDocumentStorageBackend(), /Invalid DOCUMENT_STORAGE_BACKEND/);
  });
});

describe("readS3DocumentStorageEnv", () => {
  it("requires bucket, region, and credentials", () => {
    process.env.DOCUMENT_STORAGE_BACKEND = "s3";
    delete process.env.S3_BUCKET;
    delete process.env.S3_REGION;
    delete process.env.S3_ACCESS_KEY_ID;
    delete process.env.S3_SECRET_ACCESS_KEY;

    assert.throws(() => readS3DocumentStorageEnv(), /S3_BUCKET/);
  });

  it("parses optional endpoint and path-style settings", () => {
    process.env.S3_BUCKET = "leases";
    process.env.S3_REGION = "auto";
    process.env.S3_ACCESS_KEY_ID = "key";
    process.env.S3_SECRET_ACCESS_KEY = "secret";
    process.env.S3_ENDPOINT = "https://example.r2.cloudflarestorage.com";
    process.env.S3_FORCE_PATH_STYLE = "true";

    const config = readS3DocumentStorageEnv();
    assert.equal(config.bucket, "leases");
    assert.equal(config.endpoint, "https://example.r2.cloudflarestorage.com");
    assert.equal(config.forcePathStyle, true);
  });
});

describe("createS3DocumentStorage", () => {
  it("reads and writes through a mocked S3 client", async () => {
    const stored = new Map<string, { bytes: Uint8Array; contentType: string }>();
    const mockClient = {
      send: async (command: { constructor: { name: string }; input: Record<string, unknown> }) => {
        if (command.constructor.name === "PutObjectCommand") {
          const Key = String(command.input.Key);
          const Body = command.input.Body as Uint8Array;
          stored.set(Key, {
            bytes: new Uint8Array(Body),
            contentType: String(command.input.ContentType),
          });
          return {};
        }
        if (command.constructor.name === "GetObjectCommand") {
          const Key = String(command.input.Key);
          const row = stored.get(Key);
          if (!row) {
            throw new Error("NoSuchKey");
          }
          return {
            Body: {
              transformToByteArray: async () => row.bytes,
            },
          };
        }
        throw new Error(`Unexpected command ${command.constructor.name}`);
      },
    };

    const storage = createS3DocumentStorage(
      {
        bucket: "test-bucket",
        region: "auto",
        accessKeyId: "key",
        secretAccessKey: "secret",
      },
      mockClient as never,
    );

    const key = "org/a/property/b/tenancy/c/doc.pdf";
    const payload = new Uint8Array([1, 2, 3]);
    await storage.writeDocument(key, payload, "application/pdf");
    const read = await storage.readDocument(key);
    assert.deepEqual(read, payload);
    assert.equal(stored.get(key)?.contentType, "application/pdf");
  });
});

describe("createDocumentStorage factory", () => {
  it("creates local storage by default", () => {
    delete process.env.DOCUMENT_STORAGE_BACKEND;
    const storage = createDocumentStorage("local");
    assert.equal(typeof storage.readDocument, "function");
    assert.equal(typeof storage.writeDocument, "function");
  });
});

describe("production document storage guard", () => {
  it("flags missing or local backend in production", () => {
    process.env.NODE_ENV = "production";
    delete process.env.DOCUMENT_STORAGE_BACKEND;
    assert.equal(isProductionDocumentStorageMisconfigured(), true);

    process.env.DOCUMENT_STORAGE_BACKEND = "local";
    assert.equal(isProductionDocumentStorageMisconfigured(), true);

    process.env.DOCUMENT_STORAGE_BACKEND = "s3";
    assert.equal(isProductionDocumentStorageMisconfigured(), false);
  });

  it("includes storage guidance in validateProductionRuntimeConfig", () => {
    process.env.NODE_ENV = "production";
    process.env.DOCUMENT_STORAGE_BACKEND = "local";
    assert.throws(() => validateProductionRuntimeConfig(), /DOCUMENT_STORAGE_BACKEND must be set to "s3"/);
    assert.match(productionDocumentStorageViolationMessage(), /executed RTB-1/i);
  });
});

describe("getLocalDocumentStorageRoot", () => {
  it("uses LOCAL_DOCUMENT_STORAGE_ROOT when configured", () => {
    process.env.LOCAL_DOCUMENT_STORAGE_ROOT = "/tmp/custom-docs";
    assert.equal(getLocalDocumentStorageRoot(), "/tmp/custom-docs");
  });
});

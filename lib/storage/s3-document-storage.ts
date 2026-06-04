import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { DocumentStorage } from "@/lib/storage/document-storage";
import { normalizeDocumentStorageKey } from "@/lib/storage/document-storage-keys";

export type S3DocumentStorageConfig = {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
  forcePathStyle?: boolean;
};

export function readS3DocumentStorageEnv(): S3DocumentStorageConfig {
  const bucket = process.env.S3_BUCKET?.trim();
  const region = process.env.S3_REGION?.trim();
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();

  const missing: string[] = [];
  if (!bucket) missing.push("S3_BUCKET");
  if (!region) missing.push("S3_REGION");
  if (!accessKeyId) missing.push("S3_ACCESS_KEY_ID");
  if (!secretAccessKey) missing.push("S3_SECRET_ACCESS_KEY");

  if (missing.length > 0) {
    throw new Error(
      `Missing required S3 document storage environment variables: ${missing.join(", ")}`,
    );
  }

  const endpoint = process.env.S3_ENDPOINT?.trim() || undefined;
  const forcePathStyleRaw = process.env.S3_FORCE_PATH_STYLE?.trim().toLowerCase();
  const forcePathStyle =
    forcePathStyleRaw === "true" || forcePathStyleRaw === "1" || Boolean(endpoint);

  return {
    bucket: bucket!,
    region: region!,
    accessKeyId: accessKeyId!,
    secretAccessKey: secretAccessKey!,
    endpoint,
    forcePathStyle,
  };
}

export function createS3DocumentStorage(
  config: S3DocumentStorageConfig,
  client?: S3Client,
): DocumentStorage {
  const s3 =
    client ??
    new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });

  return {
    async readDocument(storageKey: string): Promise<Uint8Array> {
      const Key = normalizeDocumentStorageKey(storageKey);
      const response = await s3.send(
        new GetObjectCommand({
          Bucket: config.bucket,
          Key,
        }),
      );

      if (!response.Body) {
        throw new Error(`Document object is empty: ${Key}`);
      }

      const bytes = await response.Body.transformToByteArray();
      return new Uint8Array(bytes);
    },

    async writeDocument(
      storageKey: string,
      bytes: Uint8Array,
      contentType?: string,
    ): Promise<void> {
      const Key = normalizeDocumentStorageKey(storageKey);
      await s3.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key,
          Body: bytes,
          ContentType: contentType ?? "application/octet-stream",
        }),
      );
    },
  };
}

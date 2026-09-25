"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button, buttonClasses } from "@/components/portal/button";
import { FOCUS_RING } from "@/components/portal/focus";
import {
  FormField,
  InlineAlert,
  InlineNotice,
  PrimaryButton,
  SURFACE_CARD,
  SURFACE_PANEL,
} from "@/components/portal/ui";
import { withBasePath } from "@/lib/app-path";
import { selectPhotoEnhancerBatch } from "@/lib/photo-enhancer/batch";
import {
  PHOTO_JOB_STATUS_LABEL,
  processPhotoQueue,
  type PhotoJobStatus,
} from "@/lib/photo-enhancer/concurrency";
import {
  PHOTO_ENHANCER_ACCEPT,
  PHOTO_ENHANCER_MAX_BATCH,
  PHOTO_ENHANCER_MAX_CONCURRENCY,
} from "@/lib/photo-enhancer/image-limits";
import { enhancedDownloadFileName, preparePhotoForUpload } from "@/lib/photo-enhancer/prepare-upload";
import { revokePhotoPreviewUrlList } from "@/lib/photo-enhancer/preview-urls";

type EnhanceErrorPayload = {
  error?: string;
};

type PhotoItem = {
  id: string;
  file: File;
  originalUrl: string;
  enhancedUrl: string | null;
  downloadName: string;
  status: PhotoJobStatus;
  error: string | null;
};

function formatFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function readEnhanceError(payload: unknown, fallback: string): string {
  if (typeof payload !== "object" || payload === null) return fallback;
  const message = (payload as EnhanceErrorPayload).error;
  return typeof message === "string" ? message : fallback;
}

function createPhotoId(file: File, index: number): string {
  return `${file.name}:${file.size}:${file.lastModified}:${index}`;
}

export function PhotoEnhancerPanel() {
  const fileId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<PhotoItem[]>([]);
  const generationRef = useRef(0);
  const queueRunningRef = useRef(false);

  const [items, setItems] = useState<PhotoItem[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [queueRunning, setQueueRunning] = useState(false);

  function replaceItems(next: PhotoItem[]) {
    itemsRef.current = next;
    setItems(next);
  }

  function patchItem(id: string, patch: Partial<PhotoItem> | ((item: PhotoItem) => PhotoItem)) {
    const next = itemsRef.current.map((item) => {
      if (item.id !== id) return item;
      return typeof patch === "function" ? patch(item) : { ...item, ...patch };
    });
    replaceItems(next);
  }

  function clearBatch() {
    generationRef.current += 1;
    revokePhotoPreviewUrlList(itemsRef.current);
    replaceItems([]);
    setNotice(null);
    setQueueRunning(false);
    queueRunningRef.current = false;
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  useEffect(() => {
    return () => {
      generationRef.current += 1;
      revokePhotoPreviewUrlList(itemsRef.current);
    };
  }, []);

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    const selection = selectPhotoEnhancerBatch(
      files.map((file) => ({
        fileName: file.name,
        contentType: file.type,
        sizeBytes: file.size,
      })),
    );

    generationRef.current += 1;
    revokePhotoPreviewUrlList(itemsRef.current);
    queueRunningRef.current = false;
    setQueueRunning(false);

    if (selection.acceptedIndexes.length === 0) {
      replaceItems([]);
      setNotice(selection.error);
      event.target.value = "";
      return;
    }

    const nextItems = selection.acceptedIndexes.map((index) => {
      const file = files[index];
      return {
        id: createPhotoId(file, index),
        file,
        originalUrl: URL.createObjectURL(file),
        enhancedUrl: null,
        downloadName: enhancedDownloadFileName(file.name),
        status: "waiting" as const,
        error: null,
      };
    });
    replaceItems(nextItems);
    setNotice(selection.error);
  }

  function claimNextWaitingId(): string | null {
    const inFlight = itemsRef.current.filter((item) => item.status === "enhancing").length;
    if (inFlight >= PHOTO_ENHANCER_MAX_CONCURRENCY) return null;
    const next = itemsRef.current.find((item) => item.status === "waiting");
    if (!next) return null;
    patchItem(next.id, { status: "enhancing", error: null });
    return next.id;
  }

  async function enhanceClaimedPhoto(id: string, generation: number) {
    const item = itemsRef.current.find((row) => row.id === id);
    if (!item) return;

    try {
      const uploadFile = await preparePhotoForUpload(item.file);
      const formData = new FormData();
      formData.set("image", uploadFile);

      const response = await fetch(withBasePath("/api/photo-enhancer/enhance"), {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      });

      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => ({}));
        throw new Error(readEnhanceError(payload, "The enhancement request failed. Try again."));
      }

      const blob = await response.blob();
      if (blob.size === 0 || blob.type !== "image/png") {
        throw new Error("The enhancement request returned an unreadable image.");
      }

      const nextUrl = URL.createObjectURL(blob);
      if (generation !== generationRef.current) {
        URL.revokeObjectURL(nextUrl);
        return;
      }

      patchItem(id, (current) => {
        if (current.enhancedUrl) URL.revokeObjectURL(current.enhancedUrl);
        return { ...current, status: "complete", enhancedUrl: nextUrl, error: null };
      });
    } catch (caught) {
      if (generation !== generationRef.current) return;
      const message = caught instanceof Error ? caught.message : "The enhancement request failed.";
      patchItem(id, { status: "failed", error: message });
    }
  }

  async function runQueue() {
    if (queueRunningRef.current) return;
    if (!itemsRef.current.some((item) => item.status === "waiting")) return;

    const generation = generationRef.current;
    queueRunningRef.current = true;
    setQueueRunning(true);
    try {
      await processPhotoQueue({
        concurrency: PHOTO_ENHANCER_MAX_CONCURRENCY,
        claimNext: () => {
          if (generation !== generationRef.current) return null;
          return claimNextWaitingId();
        },
        process: (id) => enhanceClaimedPhoto(id, generation),
      });
    } finally {
      if (generation === generationRef.current) {
        queueRunningRef.current = false;
        setQueueRunning(false);
      }
    }
  }

  function retryPhoto(id: string) {
    const item = itemsRef.current.find((row) => row.id === id);
    if (!item || item.status !== "failed") return;
    patchItem(id, (current) => {
      if (current.enhancedUrl) URL.revokeObjectURL(current.enhancedUrl);
      return { ...current, status: "waiting", enhancedUrl: null, error: null };
    });
    void runQueue();
  }

  const waitingCount = items.filter((item) => item.status === "waiting").length;
  const enhancingCount = items.filter((item) => item.status === "enhancing").length;
  const completeCount = items.filter((item) => item.status === "complete").length;
  const failedCount = items.filter((item) => item.status === "failed").length;
  const canEnhanceBatch = items.length > 0 && waitingCount > 0 && !queueRunning && enhancingCount === 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-lg font-semibold text-foreground">Photo Enhancer</h1>
        <p className="mt-1 text-sm leading-relaxed text-foreground-muted">
          Professionally enhance real-estate photographs while preserving the factual contents of
          the property. Upload up to {PHOTO_ENHANCER_MAX_BATCH} photos, then review each result
          before you download it.
        </p>
      </header>

      {notice ? <InlineAlert>{notice}</InlineAlert> : null}

      <section className={`${SURFACE_PANEL} space-y-4 px-4 py-4`}>
        <FormField
          htmlFor={fileId}
          label="Photographs"
          helper={`JPG, PNG, or WebP. Up to ${PHOTO_ENHANCER_MAX_BATCH} photos. Large phone photos are resized in the browser before upload.`}
        >
          <input
            ref={fileInputRef}
            id={fileId}
            type="file"
            multiple
            accept={PHOTO_ENHANCER_ACCEPT}
            onChange={onFileChange}
            className={`block w-full text-sm text-foreground file:mr-3 file:rounded-lg file:border file:border-border file:bg-surface file:px-3 file:py-2 file:text-sm file:font-medium ${FOCUS_RING}`}
          />
        </FormField>

        {items.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-foreground-muted">
              {items.length} photo{items.length === 1 ? "" : "s"} selected
              {completeCount || failedCount || enhancingCount
                ? ` · ${completeCount} complete · ${failedCount} failed · ${enhancingCount} enhancing`
                : null}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {items.map((item) => (
                <article key={item.id} className={`${SURFACE_CARD} space-y-3 overflow-hidden p-3`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{item.file.name}</p>
                      <p className="text-xs text-foreground-muted">{formatFileSize(item.file.size)}</p>
                    </div>
                    <p className="shrink-0 text-xs font-semibold text-foreground">
                      {PHOTO_JOB_STATUS_LABEL[item.status]}
                    </p>
                  </div>

                  <div className={`grid gap-3 ${item.enhancedUrl ? "sm:grid-cols-2" : ""}`}>
                    <figure>
                      <figcaption className="mb-1 text-xs font-semibold text-foreground">Original</figcaption>
                      {/* Preview of a local object URL; not a remote/CMS asset. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.originalUrl}
                        alt={`Original photograph ${item.file.name}`}
                        className="max-h-56 w-full rounded-lg object-contain"
                      />
                    </figure>
                    {item.enhancedUrl ? (
                      <figure>
                        <figcaption className="mb-1 text-xs font-semibold text-foreground">Enhanced</figcaption>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.enhancedUrl}
                          alt={`Enhanced photograph ${item.file.name}`}
                          className="max-h-56 w-full rounded-lg object-contain"
                        />
                      </figure>
                    ) : null}
                  </div>

                  {item.status === "failed" && item.error ? (
                    <p className="text-sm text-danger" role="alert">
                      {item.error}
                    </p>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    {item.enhancedUrl ? (
                      <a
                        href={item.enhancedUrl}
                        download={item.downloadName}
                        className={buttonClasses({ variant: "primary" })}
                      >
                        Download PNG
                      </a>
                    ) : null}
                    {item.status === "failed" ? (
                      <Button type="button" variant="secondary" onClick={() => retryPhoto(item.id)}>
                        Retry
                      </Button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>

            {completeCount > 0 ? (
              <InlineNotice>
                Review each enhanced image before marketing use and confirm the property has not been
                materially altered.
              </InlineNotice>
            ) : null}

            <div className="flex flex-wrap gap-3">
              {canEnhanceBatch ? (
                <PrimaryButton type="button" onClick={() => void runQueue()}>
                  Enhance Photos
                </PrimaryButton>
              ) : null}
              {queueRunning ? (
                <PrimaryButton type="button" disabled>
                  Enhancing…
                </PrimaryButton>
              ) : null}
              <Button type="button" variant="secondary" onClick={clearBatch}>
                Start Again
              </Button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

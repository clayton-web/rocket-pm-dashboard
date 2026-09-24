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
import { PHOTO_ENHANCER_ACCEPT } from "@/lib/photo-enhancer/image-limits";
import { enhancedDownloadFileName, preparePhotoForUpload } from "@/lib/photo-enhancer/prepare-upload";
import { validatePhotoEnhancerUpload } from "@/lib/photo-enhancer/validate-upload";

type EnhanceErrorPayload = {
  error?: string;
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

export function PhotoEnhancerPanel() {
  const fileId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const originalUrlRef = useRef<string | null>(null);
  const enhancedUrlRef = useRef<string | null>(null);

  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [enhancedUrl, setEnhancedUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState("photo-enhanced.png");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function revokeOriginalUrl() {
    if (originalUrlRef.current) {
      URL.revokeObjectURL(originalUrlRef.current);
      originalUrlRef.current = null;
    }
  }

  function revokeEnhancedUrl() {
    if (enhancedUrlRef.current) {
      URL.revokeObjectURL(enhancedUrlRef.current);
      enhancedUrlRef.current = null;
    }
  }

  useEffect(() => {
    return () => {
      revokeOriginalUrl();
      revokeEnhancedUrl();
    };
  }, []);

  function resetWorkflow() {
    revokeOriginalUrl();
    revokeEnhancedUrl();
    setOriginalFile(null);
    setOriginalUrl(null);
    setEnhancedUrl(null);
    setDownloadName("photo-enhanced.png");
    setError(null);
    setPending(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    revokeEnhancedUrl();
    setEnhancedUrl(null);
    setError(null);

    if (!file) {
      revokeOriginalUrl();
      setOriginalFile(null);
      setOriginalUrl(null);
      return;
    }

    const check = validatePhotoEnhancerUpload({
      fileName: file.name,
      contentType: file.type,
      sizeBytes: file.size,
      enforceSize: false,
    });
    if (!check.ok) {
      revokeOriginalUrl();
      setOriginalFile(null);
      setOriginalUrl(null);
      setError(check.error);
      event.target.value = "";
      return;
    }

    revokeOriginalUrl();
    const nextUrl = URL.createObjectURL(file);
    originalUrlRef.current = nextUrl;
    setOriginalFile(file);
    setOriginalUrl(nextUrl);
    setDownloadName(enhancedDownloadFileName(file.name));
  }

  async function onEnhance() {
    if (!originalFile || pending) return;
    setError(null);
    setPending(true);

    try {
      const uploadFile = await preparePhotoForUpload(originalFile);
      const formData = new FormData();
      formData.set("image", uploadFile);

      const response = await fetch(withBasePath("/api/photo-enhancer/enhance"), {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      });

      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => ({}));
        setError(readEnhanceError(payload, "The enhancement request failed. Try again."));
        return;
      }

      const blob = await response.blob();
      if (blob.size === 0 || blob.type !== "image/png") {
        setError("The enhancement request returned an unreadable image.");
        return;
      }

      revokeEnhancedUrl();
      const nextUrl = URL.createObjectURL(blob);
      enhancedUrlRef.current = nextUrl;
      setEnhancedUrl(nextUrl);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "The enhancement request failed.";
      setError(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-lg font-semibold text-foreground">Photo Enhancer</h1>
        <p className="mt-1 text-sm leading-relaxed text-foreground-muted">
          Professionally enhance a real-estate photograph while preserving the factual contents of
          the property. One photo at a time — review the result before you download it.
        </p>
      </header>

      {error ? <InlineAlert>{error}</InlineAlert> : null}

      <section className={`${SURFACE_PANEL} space-y-4 px-4 py-4`}>
        <FormField
          htmlFor={fileId}
          label="Photograph"
          helper="JPG, PNG, or WebP. Large phone photos are resized in the browser before upload."
        >
          <input
            ref={fileInputRef}
            id={fileId}
            type="file"
            accept={PHOTO_ENHANCER_ACCEPT}
            onChange={onFileChange}
            className={`block w-full text-sm text-foreground file:mr-3 file:rounded-lg file:border file:border-border file:bg-surface file:px-3 file:py-2 file:text-sm file:font-medium ${FOCUS_RING}`}
          />
        </FormField>

        {originalFile && originalUrl ? (
          <div className="space-y-3">
            <p className="text-sm text-foreground-muted">
              {originalFile.name} · {formatFileSize(originalFile.size)}
            </p>
            {!enhancedUrl ? (
              <>
                <figure className={`${SURFACE_CARD} overflow-hidden p-3`}>
                  <figcaption className="mb-2 text-sm font-semibold text-foreground">Original</figcaption>
                  {/* Preview of a local object URL; not a remote/CMS asset. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={originalUrl}
                    alt="Original property photograph"
                    className="max-h-[28rem] w-full rounded-lg object-contain"
                  />
                </figure>
                <PrimaryButton type="button" disabled={pending} onClick={() => void onEnhance()}>
                  {pending ? "Enhancing…" : "Enhance"}
                </PrimaryButton>
              </>
            ) : null}
          </div>
        ) : null}
      </section>

      {enhancedUrl && originalUrl ? (
        <section className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <figure className={`${SURFACE_CARD} overflow-hidden p-3`}>
              <figcaption className="mb-2 text-sm font-semibold text-foreground">Original</figcaption>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={originalUrl}
                alt="Original property photograph for comparison"
                className="max-h-[28rem] w-full rounded-lg object-contain"
              />
            </figure>
            <figure className={`${SURFACE_CARD} overflow-hidden p-3`}>
              <figcaption className="mb-2 text-sm font-semibold text-foreground">Enhanced</figcaption>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={enhancedUrl}
                alt="Enhanced property photograph"
                className="max-h-[28rem] w-full rounded-lg object-contain"
              />
            </figure>
          </div>

          <InlineNotice>
            Review the enhanced image before marketing use and confirm the property has not been
            materially altered.
          </InlineNotice>

          <div className="flex flex-wrap gap-3">
            <a
              href={enhancedUrl}
              download={downloadName}
              className={buttonClasses({ variant: "primary" })}
            >
              Download PNG
            </a>
            <Button type="button" variant="secondary" onClick={resetWorkflow}>
              Start Again
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

"use client";

import { FOCUS_RING } from "@/components/portal/focus";
import React, { useCallback, useEffect, useId, useRef, useState } from "react";

type SignaturePadProps = {
  onChange: (dataUrl: string | null) => void;
  disabled?: boolean;
};

/**
 * Fixed output colours for the serialized signature bitmap, not theme values.
 *
 * Exported so a test can assert they stay literal: a persisted signature must look the same on
 * every future render of the agreement, which it would not if these tracked a CSS variable.
 */
export const SIGNATURE_BACKGROUND = "#ffffff";
export const SIGNATURE_INK = "#111827";

function getPoint(event: React.PointerEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

export function SignaturePad({ onChange, disabled = false }: SignaturePadProps) {
  const instructionsId = useId();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const hasInkRef = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(320, Math.floor(rect.width * 2));
    canvas.height = Math.max(120, Math.floor(rect.height * 2));
    const ctx = canvas.getContext("2d");
    if (ctx) {
      // These two are deliberately raw and must not become theme tokens. `toDataURL` below
      // serializes these exact pixels into the PNG that is persisted and reproduced on the
      // executed agreement, so the signature has to render identically regardless of what the
      // portal theme is doing. See docs/branding.md.
      ctx.fillStyle = SIGNATURE_BACKGROUND;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = SIGNATURE_INK;
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }
    setHasInk(false);
    hasInkRef.current = false;
    onChange(null);
  }, [onChange]);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [resizeCanvas]);

  function emitChange() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onChange(canvas.toDataURL("image/png"));
  }

  function startDraw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    drawingRef.current = true;
    canvas.setPointerCapture(event.pointerId);
    const point = getPoint(event, canvas);
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  }

  function draw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || disabled) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const point = getPoint(event, canvas);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    if (!hasInkRef.current) {
      hasInkRef.current = true;
      setHasInk(true);
    }
  }

  function endDraw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = canvasRef.current;
    if (canvas?.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    if (hasInkRef.current) emitChange();
  }

  function clear() {
    resizeCanvas();
  }

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-border-strong bg-surface">
        <canvas
          ref={canvasRef}
          className="h-32 w-full touch-none"
          aria-label="Signature pad"
          aria-describedby={instructionsId}
          onPointerDown={startDraw}
          onPointerMove={draw}
          onPointerUp={endDraw}
          onPointerLeave={endDraw}
          onPointerCancel={endDraw}
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <p id={instructionsId} className="text-xs text-foreground-subtle">
          Sign with your finger, stylus, or mouse.
        </p>
        <button
          type="button"
          className={`text-sm font-medium text-foreground-muted underline disabled:opacity-50 ${FOCUS_RING}`}
          disabled={disabled || !hasInk}
          onClick={clear}
        >
          Clear
        </button>
      </div>
    </div>
  );
}

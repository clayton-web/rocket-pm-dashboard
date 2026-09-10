import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  SIGNATURE_BACKGROUND,
  SIGNATURE_INK,
  SignaturePad,
} from "@/components/signing/signature-pad";

/** The pad uses hooks, so it has to go through the renderer rather than be called directly. */
const render = () => renderToStaticMarkup(React.createElement(SignaturePad, { onChange: () => {} }));

/**
 * The signature bitmap is persisted and reproduced on the executed agreement, so its two colours
 * are output values rather than theme values. A future palette sweep that "helpfully" routes them
 * through a CSS variable would make already-stored signatures render differently, so these are
 * pinned deliberately.
 */
describe("signature output colours", () => {
  it("keeps the serialized colours as literal hex", () => {
    assert.equal(SIGNATURE_BACKGROUND, "#ffffff");
    assert.equal(SIGNATURE_INK, "#111827");
  });

  it("does not resolve them through a CSS variable or theme token", () => {
    for (const value of [SIGNATURE_BACKGROUND, SIGNATURE_INK]) {
      assert.doesNotMatch(value, /var\(|--|currentColor|token/i, value);
      assert.match(value, /^#[0-9a-f]{6}$/, value);
    }
  });

  it("keeps enough contrast for the ink to survive being flattened into the document", () => {
    const channels = (hex: string) =>
      [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const luminance = (hex: string) => {
      const [r, g, b] = channels(hex).map((c) =>
        c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
      );
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio =
      (Math.max(luminance(SIGNATURE_BACKGROUND), luminance(SIGNATURE_INK)) + 0.05) /
      (Math.min(luminance(SIGNATURE_BACKGROUND), luminance(SIGNATURE_INK)) + 0.05);
    assert.ok(ratio > 7, `signature contrast fell to ${ratio.toFixed(2)}`);
  });

  it("paints the canvas with the exported constants rather than inline literals", () => {
    const source = readFileSync("components/signing/signature-pad.tsx", "utf8");
    assert.match(source, /ctx\.fillStyle = SIGNATURE_BACKGROUND/);
    assert.match(source, /ctx\.strokeStyle = SIGNATURE_INK/);
  });
});

describe("SignaturePad", () => {
  it("gives the canvas an accessible name and points it at the drawing instructions", () => {
    const html = render();
    const describedBy = html.match(/aria-describedby="([^"]+)"/)?.[1];

    assert.match(html, /aria-label="Signature pad"/);
    assert.ok(describedBy, "canvas has no description");
    assert.ok(
      html.includes(`id="${describedBy}"`),
      "aria-describedby points at an element that is not rendered",
    );
    assert.match(html, /Sign with your finger, stylus, or mouse\./);
  });

  it("uses semantic tokens for the surrounding chrome", () => {
    const html = render();
    assert.match(html, /border-border-strong/);
    assert.doesNotMatch(html, /\b(?:bg|text|border)-(?:neutral|gray|slate|zinc)-\d{2,3}\b/);
  });

  it("gives the clear control a visible focus stop", () => {
    const html = render();
    assert.match(html, /focus-visible:outline-focus/);
  });
});

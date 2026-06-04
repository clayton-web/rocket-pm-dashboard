import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSignatureImageStorageKey,
  parseSignaturePngDataUrl,
} from "@/lib/leasing/lease-signing-signature-image";

describe("lease signing signature image", () => {
  it("parses PNG data URLs", () => {
    const png = Buffer.from([137, 80, 78, 71]);
    const dataUrl = `data:image/png;base64,${png.toString("base64")}`;
    const bytes = parseSignaturePngDataUrl(dataUrl);
    assert.deepEqual(Array.from(bytes), Array.from(png));
  });

  it("rejects invalid signature payloads", () => {
    assert.throws(() => parseSignaturePngDataUrl("not-a-data-url"), /PNG/);
  });

  it("builds tenancy-scoped signature storage keys", () => {
    const key = buildSignatureImageStorageKey({
      organizationId: "org-1",
      propertyId: "prop-1",
      tenancyId: "ten-1",
      signatureRequestId: "sig-1",
      signerRole: "tenant",
    });
    assert.match(key, /org\/org-1\/property\/prop-1\/tenancy\/ten-1\/signatures\/sig-1\/tenant\.png/);
  });
});

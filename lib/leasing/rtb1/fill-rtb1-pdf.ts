import { PDFDocument } from "pdf-lib";
import type { Rtb1PdfFieldValues } from "./field-values";

export async function fillRtb1PdfTemplate(
  templateBytes: Uint8Array,
  fieldValues: Rtb1PdfFieldValues,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(templateBytes);
  const form = pdf.getForm();

  for (const [fieldName, value] of Object.entries(fieldValues)) {
    if (value.kind === "text") {
      if (!value.value.trim()) continue;
      try {
        form.getTextField(fieldName).setText(value.value);
      } catch {
        // Skip fields that are not text fields in this template revision.
      }
      continue;
    }

    if (!value.checked) continue;
    try {
      form.getCheckBox(fieldName).check();
    } catch {
      // Skip fields that are not checkbox fields in this template revision.
    }
  }

  return pdf.save();
}

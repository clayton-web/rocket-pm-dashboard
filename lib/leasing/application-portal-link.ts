export type ApplicationPortalHandoff = {
  portalPath: string;
  propertyName: string;
  unitLabel: string | null;
  email: string;
  instructionText: string;
  copyText: string;
};

export function buildApplicationPortalHandoff(input: {
  propertyName: string;
  unitLabel: string | null;
  email: string;
  origin?: string | null;
}): ApplicationPortalHandoff {
  const portalPath = "/portal/application";
  const absoluteUrl =
    input.origin && input.origin.trim()
      ? `${input.origin.replace(/\/$/, "")}${portalPath}`
      : portalPath;
  const unitLine = input.unitLabel ? `Unit: ${input.unitLabel}` : "Unit: (select on the form)";
  const instructionText = [
    "Send the prospect to the rental application form.",
    `They should select ${input.propertyName}, choose their unit, and enter ${input.email} for prefill.`,
  ].join(" ");
  const copyText = [
    `Apply online: ${absoluteUrl}`,
    `Property: ${input.propertyName}`,
    unitLine,
    `Email (must match for prefill): ${input.email}`,
  ].join("\n");

  return {
    portalPath,
    propertyName: input.propertyName,
    unitLabel: input.unitLabel,
    email: input.email,
    instructionText,
    copyText,
  };
}

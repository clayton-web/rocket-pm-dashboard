import type { BriefingSettingsInput } from "@/lib/briefing/briefing-settings.service";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function parseBoolean(value: unknown, field: string): boolean | { error: string } {
  if (value === true || value === "true" || value === "on" || value === "1") return true;
  if (value === false || value === "false" || value === "off" || value === "0") return false;
  return { error: `${field} must be true or false.` };
}

function parseString(value: unknown, field: string): string | { error: string } {
  if (typeof value !== "string") return { error: `${field} is required.` };
  const trimmed = value.trim();
  if (!trimmed) return { error: `${field} is required.` };
  return trimmed;
}

function parseLookbackHours(value: unknown): number | { error: string } {
  const raw = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(raw)) return { error: "Lookback hours must be a number." };
  const hours = Math.floor(raw);
  if (hours < 1 || hours > 48) {
    return { error: "Lookback hours must be between 1 and 48." };
  }
  return hours;
}

function parseEmailRecipients(value: unknown): string[] | { error: string } {
  if (Array.isArray(value)) {
    const emails = value
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean);
    return emails;
  }

  if (typeof value === "string") {
    const emails = value
      .split(/[,\n]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
    return emails;
  }

  return [];
}

export function parseBriefingSettingsInput(
  input: unknown,
): BriefingSettingsInput | { error: string } {
  if (!input || typeof input !== "object") {
    return { error: "Invalid settings payload." };
  }

  const raw = input as Record<string, unknown>;

  const enabled = parseBoolean(raw.enabled, "enabled");
  if (typeof enabled !== "boolean") return enabled;

  const morningEnabled = parseBoolean(raw.morningEnabled, "morningEnabled");
  if (typeof morningEnabled !== "boolean") return morningEnabled;

  const afternoonEnabled = parseBoolean(raw.afternoonEnabled, "afternoonEnabled");
  if (typeof afternoonEnabled !== "boolean") return afternoonEnabled;

  const autoSyncBeforeBriefing = parseBoolean(raw.autoSyncBeforeBriefing, "autoSyncBeforeBriefing");
  if (typeof autoSyncBeforeBriefing !== "boolean") return autoSyncBeforeBriefing;

  const autoBriefingEnabled = parseBoolean(raw.autoBriefingEnabled, "autoBriefingEnabled");
  if (typeof autoBriefingEnabled !== "boolean") return autoBriefingEnabled;

  const timezone = parseString(raw.timezone, "timezone");
  if (typeof timezone !== "string") return timezone;

  const morningLocalTime = parseString(raw.morningLocalTime, "morningLocalTime");
  if (typeof morningLocalTime !== "string") return morningLocalTime;
  if (!TIME_PATTERN.test(morningLocalTime)) {
    return { error: "Morning time must use HH:mm format." };
  }

  const afternoonLocalTime = parseString(raw.afternoonLocalTime, "afternoonLocalTime");
  if (typeof afternoonLocalTime !== "string") return afternoonLocalTime;
  if (!TIME_PATTERN.test(afternoonLocalTime)) {
    return { error: "Afternoon time must use HH:mm format." };
  }

  const lookbackHours = parseLookbackHours(raw.lookbackHours);
  if (typeof lookbackHours !== "number") return lookbackHours;

  const emailRecipients = parseEmailRecipients(raw.emailRecipients);
  if ("error" in emailRecipients) return emailRecipients;

  return {
    enabled,
    morningEnabled,
    afternoonEnabled,
    timezone,
    morningLocalTime,
    afternoonLocalTime,
    emailRecipients,
    autoSyncBeforeBriefing,
    lookbackHours,
    autoBriefingEnabled,
  };
}

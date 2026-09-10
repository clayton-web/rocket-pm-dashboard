import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const workflowPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../.github/workflows/daily-briefing-cron.yml",
);

describe("scheduled Gmail cron workflow", () => {
  const source = readFileSync(workflowPath, "utf8");

  it("keeps the twice-daily cadence", () => {
    assert.match(source, /cron:\s*"0 14 \* \* \*"/);
    assert.match(source, /cron:\s*"0 21 \* \* \*"/);
  });

  it("schedules independent Gmail sync and drains the shared processor", () => {
    assert.match(source, /\/api\/internal\/gmail\/schedule/);
    assert.match(source, /\/api\/internal\/jobs\/process/);
    assert.match(source, /Enqueue independent Gmail schedule/);
  });

  it("does not call automated Daily Briefing scheduling", () => {
    assert.doesNotMatch(source, /\/api\/internal\/briefing\/schedule/);
    assert.doesNotMatch(source, /Enqueue briefing schedule/);
    assert.doesNotMatch(source, /slot=MORNING|slot=AFTERNOON/);
    assert.doesNotMatch(source, /sleep 360/);
  });

  it("uses the existing processor secret and production host", () => {
    assert.match(source, /secrets\.JOB_PROCESSOR_SECRET/);
    assert.match(source, /APP_BASE_URL: https:\/\/www\.rocketlogic\.ca/);
    assert.match(source, /Authorization: Bearer \$\{JOB_PROCESSOR_SECRET\}/);
  });
});

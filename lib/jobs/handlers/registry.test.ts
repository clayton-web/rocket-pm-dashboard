import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { listRegisteredJobTypes } from "@/lib/jobs/handlers/registry";
import { JOB_TYPES } from "@/lib/jobs/types";

describe("job handler registry", () => {
  it("registers gmail.sync handler", () => {
    const types = listRegisteredJobTypes();
    assert.ok(types.includes(JOB_TYPES.GMAIL_SYNC));
    assert.ok(types.includes(JOB_TYPES.SYSTEM_NOOP));
  });
});

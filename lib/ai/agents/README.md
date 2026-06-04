# AI agents (future)

Phase 0 does not implement agents here. When adding triage or draft agents:

1. Implement handlers under `lib/jobs/handlers/` that create `AgentRun` records.
2. Call existing generation logic via thin adapters — do not modify frozen `generate-responder-draft.ts` without a version bump.
3. Never enqueue Gmail send jobs or call send APIs from the job processor.

See [docs/agent-job-framework.md](../../../docs/agent-job-framework.md).

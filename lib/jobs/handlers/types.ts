import type { BackgroundJob } from "@prisma/client";

export type JobHandlerContext = {
  job: BackgroundJob;
  workerId: string;
};

export type JobHandlerResult = {
  metadata?: Record<string, unknown>;
};

export type JobHandler = (ctx: JobHandlerContext) => Promise<JobHandlerResult>;

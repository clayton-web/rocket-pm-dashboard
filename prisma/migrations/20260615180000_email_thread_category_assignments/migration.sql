CREATE TYPE "EmailThreadCategoryAssignmentSource" AS ENUM ('RULE', 'AI', 'MANUAL', 'APPROVED_RULE');

CREATE TABLE "EmailThreadCategoryAssignment" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "category" "EmailThreadCategory" NOT NULL,
    "source" "EmailThreadCategoryAssignmentSource" NOT NULL,
    "reason" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailThreadCategoryAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailThreadCategoryAssignment_threadId_category_key" ON "EmailThreadCategoryAssignment"("threadId", "category");
CREATE INDEX "EmailThreadCategoryAssignment_threadId_idx" ON "EmailThreadCategoryAssignment"("threadId");
CREATE INDEX "EmailThreadCategoryAssignment_category_assignedAt_idx" ON "EmailThreadCategoryAssignment"("category", "assignedAt");

ALTER TABLE "EmailThreadCategoryAssignment" ADD CONSTRAINT "EmailThreadCategoryAssignment_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "EmailThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP TABLE "EmailSenderCategoryMemory";

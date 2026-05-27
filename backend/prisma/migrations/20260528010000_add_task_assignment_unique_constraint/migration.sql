-- Remove duplicate task assignments before enforcing uniqueness.
DELETE FROM "TaskAssignment" duplicate
USING "TaskAssignment" original
WHERE duplicate."taskId" = original."taskId"
  AND duplicate."userId" = original."userId"
  AND duplicate."id" > original."id";

-- Replace the lookup index with a unique index for the same columns.
DROP INDEX IF EXISTS "TaskAssignment_taskId_userId_idx";
CREATE UNIQUE INDEX "TaskAssignment_taskId_userId_key" ON "TaskAssignment"("taskId", "userId");

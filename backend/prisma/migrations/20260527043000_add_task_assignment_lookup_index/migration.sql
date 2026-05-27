INSERT INTO "TaskAssignment" ("id", "taskId", "userId")
SELECT
  'owner_' || md5("Task"."id" || ':' || "Task"."userId"),
  "Task"."id",
  "Task"."userId"
FROM "Task"
WHERE NOT EXISTS (
  SELECT 1
  FROM "TaskAssignment"
  WHERE "TaskAssignment"."taskId" = "Task"."id"
    AND "TaskAssignment"."userId" = "Task"."userId"
);

CREATE INDEX "TaskAssignment_taskId_userId_idx" ON "TaskAssignment"("taskId", "userId");

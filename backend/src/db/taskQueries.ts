import { Prisma } from '@prisma/client';
import type { TransactionClient } from './prisma';
import { idSelect, publicUserSelect } from './selects';

type TaskQueryClient = Pick<TransactionClient, 'comment' | 'task'>;
type TaskAssignmentQueryClient = Pick<TransactionClient, 'taskAssignment'>;
type TaskFullTextSearchClient = Pick<TransactionClient, '$queryRaw'>;

interface TaskFullTextSearchFilters {
  userId: string;
  search: string;
  status?: string;
  priority?: string;
}

export const taskListInclude = {
  assignments: {
    include: {
      user: {
        select: publicUserSelect,
      },
    },
  },
} as const satisfies Prisma.TaskInclude;

export const commentWithUserInclude = {
  user: {
    select: publicUserSelect,
  },
} as const satisfies Prisma.CommentInclude;

const commentOwnerSelect = {
  id: true,
  taskId: true,
} as const satisfies Prisma.CommentSelect;

export const taskDetailInclude = {
  assignments: {
    include: {
      user: {
        select: publicUserSelect,
      },
    },
  },
  comments: {
    include: commentWithUserInclude,
    orderBy: {
      createdAt: 'desc',
    },
  },
} as const satisfies Prisma.TaskInclude;

export const findTaskIdForUser = (client: TaskQueryClient, userId: string, taskId: string) =>
  client.task.findFirst({
    where: {
      id: taskId,
      userId,
    },
    select: idSelect,
  });

export const findVisibleTaskIdForUser = (client: TaskQueryClient, userId: string, taskId: string) =>
  client.task.findFirst({
    where: {
      id: taskId,
      assignments: {
        some: {
          userId,
        },
      },
    },
    select: idSelect,
  });

export const taskVisibleToUser = async (client: TaskQueryClient, userId: string, taskId: string) =>
  (await findVisibleTaskIdForUser(client, userId, taskId)) !== null;

export const taskAssignedToUser = async (
  client: TaskAssignmentQueryClient,
  userId: string,
  taskId: string,
) =>
  (await client.taskAssignment.findFirst({
    where: {
      taskId,
      userId,
    },
    select: idSelect,
  })) !== null;

export const findTaskIdsByFullTextSearch = async (
  client: TaskFullTextSearchClient,
  { userId, search, status, priority }: TaskFullTextSearchFilters,
) => {
  const statusClause = status ? Prisma.sql`AND t."status" = ${status}` : Prisma.empty;
  const priorityClause = priority ? Prisma.sql`AND t."priority" = ${priority}` : Prisma.empty;
  const searchVector = Prisma.sql`
    to_tsvector('english', coalesce(t."title", '') || ' ' || coalesce(t."description", ''))
  `;

  const rows = await client.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    WITH search_query AS (
      SELECT websearch_to_tsquery('english', ${search}) AS value
    )
    SELECT t."id"
    FROM "Task" t
    CROSS JOIN search_query sq
    WHERE EXISTS (
      SELECT 1
      FROM "TaskAssignment" ta
      WHERE ta."taskId" = t."id"
        AND ta."userId" = ${userId}
    )
      ${statusClause}
      ${priorityClause}
      AND ${searchVector} @@ sq.value
    ORDER BY ts_rank_cd(${searchVector}, sq.value) DESC, t."updatedAt" DESC, t."id" ASC
  `);

  return rows.map((row) => row.id);
};

export const findCommentForTaskOwner = (client: TaskQueryClient, userId: string, commentId: string) =>
  client.comment.findFirst({
    where: {
      id: commentId,
      task: {
        userId,
      },
    },
    select: commentOwnerSelect,
  });

export const findCommentForAuthorOrTaskOwner = (client: TaskQueryClient, userId: string, commentId: string) =>
  client.comment.findFirst({
    where: {
      id: commentId,
      OR: [
        { userId },
        {
          task: {
            userId,
          },
        },
      ],
    },
    select: commentOwnerSelect,
  });

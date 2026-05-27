import type { Prisma } from '@prisma/client';
import type { TransactionClient } from './prisma';
import { idSelect, publicUserSelect } from './selects';

type TaskQueryClient = Pick<TransactionClient, 'comment' | 'task'>;
type TaskAssignmentQueryClient = Pick<TransactionClient, 'taskAssignment'>;

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

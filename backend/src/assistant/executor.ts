import {
  isForeignKeyConstraintError,
  isRecordNotFoundError,
  prisma,
  type TransactionClient,
} from '../db/prisma';
import { findCommentForTaskOwner, findTaskIdForUser } from '../db/taskQueries';
import type { AssistantDraftOperation, AssistantDraftShape, AssistantExecutionResult } from './types';

export class DraftExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DraftExecutionError';
  }
}

export const executeApprovedDraft = async (
  userId: string,
  draft: AssistantDraftShape,
): Promise<AssistantExecutionResult> => {
  try {
    const operations = await prisma.$transaction(async (tx) => {
      const results: AssistantExecutionResult['operations'] = [];

      for (const operation of draft.operations) {
        const result = await executeOperation(tx, userId, operation);
        results.push(result);
      }

      return results;
    });

    return {
      ok: true,
      operations,
    };
  } catch (error) {
    throw new DraftExecutionError(errorMessageFor(error));
  }
};

const executeOperation = async (
  tx: TransactionClient,
  userId: string,
  operation: AssistantDraftOperation,
): Promise<AssistantExecutionResult['operations'][number]> => {
  switch (operation.type) {
    case 'create_task': {
      const task = await tx.task.create({
        data: {
          title: operation.input.title,
          description: operation.input.description,
          status: operation.input.status || 'TODO',
          priority: operation.input.priority || 'MEDIUM',
          userId,
        },
      });

      return {
        operationId: operation.id,
        type: operation.type,
        ok: true,
        entityId: task.id,
        taskId: task.id,
      };
    }

    case 'update_task': {
      const task = await tx.task.update({
        where: {
          id: operation.taskId,
          userId,
        },
        data: {
          ...(operation.patch.title !== undefined && { title: operation.patch.title }),
          ...(operation.patch.description !== undefined && { description: operation.patch.description }),
          ...(operation.patch.status !== undefined && { status: operation.patch.status }),
          ...(operation.patch.priority !== undefined && { priority: operation.patch.priority }),
        },
      });

      return {
        operationId: operation.id,
        type: operation.type,
        ok: true,
        entityId: task.id,
        taskId: task.id,
      };
    }

    case 'delete_task': {
      const task = await findTaskIdForUser(tx, userId, operation.taskId);

      if (!task) {
        throw new DraftExecutionError('Task not found');
      }

      await tx.comment.deleteMany({ where: { taskId: operation.taskId } });
      await tx.taskAssignment.deleteMany({ where: { taskId: operation.taskId } });
      await tx.taskTag.deleteMany({ where: { taskId: operation.taskId } });
      await tx.task.delete({ where: { id: operation.taskId } });

      return {
        operationId: operation.id,
        type: operation.type,
        ok: true,
        entityId: task.id,
        taskId: task.id,
      };
    }

    case 'create_comment': {
      await assertTaskBelongsToUser(tx, userId, operation.taskId);

      const comment = await tx.comment.create({
        data: {
          taskId: operation.taskId,
          userId,
          content: operation.input.content,
        },
      });

      return {
        operationId: operation.id,
        type: operation.type,
        ok: true,
        entityId: comment.id,
        taskId: operation.taskId,
      };
    }

    case 'delete_comment': {
      const comment = await findCommentForTaskOwner(tx, userId, operation.commentId);

      if (!comment) {
        throw new DraftExecutionError('Comment not found');
      }

      await tx.comment.delete({
        where: {
          id: operation.commentId,
        },
      });

      return {
        operationId: operation.id,
        type: operation.type,
        ok: true,
        entityId: operation.commentId,
        taskId: comment.taskId,
      };
    }
  }
};

const assertTaskBelongsToUser = async (
  tx: TransactionClient,
  userId: string,
  taskId: string,
) => {
  const task = await findTaskIdForUser(tx, userId, taskId);

  if (!task) {
    throw new DraftExecutionError('Task not found');
  }
};

const errorMessageFor = (error: unknown) => {
  if (error instanceof DraftExecutionError) {
    return error.message;
  }

  if (isRecordNotFoundError(error)) {
    return 'Task or comment not found';
  }

  if (isForeignKeyConstraintError(error)) {
    return 'Delete failed because related comments, assignments, or tags still exist';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Draft execution failed';
};

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DraftExecutionError, executeApprovedDraft } from './executor';
import type { AssistantDraftShape } from './types';

const mocks = vi.hoisted(() => {
  const tx = {
    user: {
      findUnique: vi.fn(),
    },
    task: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findFirst: vi.fn(),
    },
    comment: {
      create: vi.fn(),
      deleteMany: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
    taskAssignment: {
      findFirst: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    taskTag: {
      deleteMany: vi.fn(),
    },
  };

  return {
    publishTaskChanged: vi.fn(),
    prisma: {
      $transaction: vi.fn(),
    },
    tx,
  };
});

vi.mock('../db/prisma', () => ({
  prisma: mocks.prisma,
  isRecordNotFoundError: (error: unknown) =>
    typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025',
  isForeignKeyConstraintError: (error: unknown) =>
    typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2003',
}));

vi.mock('../realtime/taskEvents', () => ({
  publishTaskChanged: mocks.publishTaskChanged,
}));

const userId = 'user-1';

const fullDraft: AssistantDraftShape = {
  schemaVersion: 1,
  summary: 'Apply a full draft',
  operations: [
    {
      id: 'create-task',
      type: 'create_task',
      label: 'Create task',
      input: {
        title: 'Created task',
        description: null,
        status: 'TODO',
        priority: 'HIGH',
      },
    },
    {
      id: 'update-task',
      type: 'update_task',
      label: 'Update task',
      taskId: 'task-2',
      patch: {
        title: 'Updated task',
        description: 'Updated description',
        status: 'IN_PROGRESS',
        priority: 'MEDIUM',
      },
    },
    {
      id: 'delete-task',
      type: 'delete_task',
      label: 'Delete task',
      taskId: 'task-3',
    },
    {
      id: 'assign-task',
      type: 'assign_task',
      label: 'Assign task',
      taskId: 'task-6',
      userId: 'user-2',
    },
    {
      id: 'unassign-task',
      type: 'unassign_task',
      label: 'Unassign task',
      taskId: 'task-7',
      userId: 'user-3',
    },
    {
      id: 'create-comment',
      type: 'create_comment',
      label: 'Create comment',
      taskId: 'task-4',
      input: {
        content: 'New comment',
      },
    },
    {
      id: 'delete-comment',
      type: 'delete_comment',
      label: 'Delete comment',
      commentId: 'comment-5',
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.$transaction.mockImplementation(async (callback: (tx: typeof mocks.tx) => unknown) => callback(mocks.tx));
});

const prismaError = (code: string) =>
  Object.assign(new Error('Prisma request failed'), { code });

describe('executeApprovedDraft', () => {
  it('executes every supported operation type in one transaction', async () => {
    mocks.tx.task.create.mockResolvedValue({ id: 'created-task' });
    mocks.tx.task.update.mockResolvedValue({ id: 'updated-task' });
    mocks.tx.task.delete.mockResolvedValue({ id: 'deleted-task' });
    mocks.tx.task.findFirst
      .mockResolvedValueOnce({ id: 'task-3' })
      .mockResolvedValueOnce({ id: 'task-6' })
      .mockResolvedValueOnce({ id: 'task-7' })
      .mockResolvedValueOnce({ id: 'task-4', assignments: [{ id: 'assignment-1' }] });
    mocks.tx.user.findUnique.mockResolvedValue({ id: 'user-2' });
    mocks.tx.taskAssignment.findFirst.mockResolvedValue(null);
    mocks.tx.comment.create.mockResolvedValue({ id: 'created-comment' });
    mocks.tx.comment.findFirst.mockResolvedValue({ id: 'comment-5', taskId: 'task-5' });
    mocks.tx.comment.delete.mockResolvedValue({ id: 'comment-5' });

    const result = await executeApprovedDraft(userId, fullDraft);

    expect(result).toEqual({
      ok: true,
      operations: [
        { operationId: 'create-task', type: 'create_task', ok: true, entityId: 'created-task', taskId: 'created-task' },
        { operationId: 'update-task', type: 'update_task', ok: true, entityId: 'updated-task', taskId: 'updated-task' },
        { operationId: 'delete-task', type: 'delete_task', ok: true, entityId: 'task-3', taskId: 'task-3' },
        { operationId: 'assign-task', type: 'assign_task', ok: true, entityId: 'user-2', taskId: 'task-6' },
        { operationId: 'unassign-task', type: 'unassign_task', ok: true, entityId: 'user-3', taskId: 'task-7' },
        { operationId: 'create-comment', type: 'create_comment', ok: true, entityId: 'created-comment', taskId: 'task-4' },
        { operationId: 'delete-comment', type: 'delete_comment', ok: true, entityId: 'comment-5', taskId: 'task-5' },
      ],
    });
    expect(mocks.tx.task.create).toHaveBeenCalledWith({
      data: {
        title: 'Created task',
        description: null,
        status: 'TODO',
        priority: 'HIGH',
        userId,
        assignments: {
          create: {
            userId,
          },
        },
      },
    });
    expect(mocks.tx.taskAssignment.create).toHaveBeenCalledWith({
      data: {
        taskId: 'task-6',
        userId: 'user-2',
      },
    });
    expect(mocks.tx.taskAssignment.deleteMany).toHaveBeenCalledWith({
      where: {
        taskId: 'task-7',
        userId: 'user-3',
      },
    });
    expect(mocks.tx.comment.delete).toHaveBeenCalledWith({
      where: {
        id: 'comment-5',
      },
    });
    expect(mocks.tx.taskAssignment.deleteMany).toHaveBeenCalledWith({ where: { taskId: 'task-3' } });
    expect(mocks.tx.taskTag.deleteMany).toHaveBeenCalledWith({ where: { taskId: 'task-3' } });
    expect(mocks.publishTaskChanged).toHaveBeenCalledTimes(6);
    for (const event of [
      { taskId: 'updated-task', action: 'updated' },
      { taskId: 'task-3', action: 'deleted' },
      { taskId: 'task-6', action: 'assignments_updated' },
      { taskId: 'task-7', action: 'assignments_updated' },
      { taskId: 'task-4', action: 'comment_created' },
      { taskId: 'task-5', action: 'comment_deleted' },
    ]) {
      expect(mocks.publishTaskChanged).toHaveBeenCalledWith({ ...event, actorUserId: userId });
    }
  });

  it('defaults optional create task fields before persistence', async () => {
    mocks.tx.task.create.mockResolvedValue({ id: 'created-task' });

    const result = await executeApprovedDraft(userId, {
      schemaVersion: 1,
      summary: 'Create a task',
      operations: [
        {
          id: 'create-task',
          type: 'create_task',
          label: 'Create task',
          input: {
            title: 'Created task',
          },
        },
      ],
    });

    expect(result.operations[0]).toMatchObject({ entityId: 'created-task' });
    expect(mocks.tx.task.create).toHaveBeenCalledWith({
      data: {
        title: 'Created task',
        description: undefined,
        status: 'TODO',
        priority: 'MEDIUM',
        userId,
        assignments: {
          create: {
            userId,
          },
        },
      },
    });
  });

  it('rejects create_comment when the task is not visible to the user', async () => {
    mocks.tx.task.findFirst.mockResolvedValue(null);

    await expect(
      executeApprovedDraft(userId, {
        schemaVersion: 1,
        summary: 'Create a comment',
        operations: [
          {
            id: 'create-comment',
            type: 'create_comment',
            label: 'Create comment',
            taskId: 'task-1',
            input: {
              content: 'Comment',
            },
          },
        ],
      }),
    ).rejects.toThrow(new DraftExecutionError('Task not found'));
  });

  it('rejects create_comment when the user is not assigned to the task', async () => {
    mocks.tx.task.findFirst.mockResolvedValue({ id: 'task-1', assignments: [] });

    await expect(
      executeApprovedDraft(userId, {
        schemaVersion: 1,
        summary: 'Create a comment',
        operations: [
          {
            id: 'create-comment',
            type: 'create_comment',
            label: 'Create comment',
            taskId: 'task-1',
            input: {
              content: 'Comment',
            },
          },
        ],
      }),
    ).rejects.toThrow(new DraftExecutionError('Only assigned users can comment on this task'));
  });

  it('rejects assign_task when the assignee does not exist', async () => {
    mocks.tx.task.findFirst.mockResolvedValue({ id: 'task-1' });
    mocks.tx.user.findUnique.mockResolvedValue(null);

    await expect(
      executeApprovedDraft(userId, {
        schemaVersion: 1,
        summary: 'Assign a task',
        operations: [
          {
            id: 'assign-task',
            type: 'assign_task',
            label: 'Assign task',
            taskId: 'task-1',
            userId: 'missing-user',
          },
        ],
      }),
    ).rejects.toThrow(new DraftExecutionError('User not found'));
  });

  it('does not create a duplicate assignment when assign_task is already satisfied', async () => {
    mocks.tx.task.findFirst.mockResolvedValue({ id: 'task-1' });
    mocks.tx.user.findUnique.mockResolvedValue({ id: 'user-2' });
    mocks.tx.taskAssignment.findFirst.mockResolvedValue({ id: 'assignment-1' });

    const result = await executeApprovedDraft(userId, {
      schemaVersion: 1,
      summary: 'Assign a task',
      operations: [
        {
          id: 'assign-task',
          type: 'assign_task',
          label: 'Assign task',
          taskId: 'task-1',
          userId: 'user-2',
        },
      ],
    });

    expect(result.operations[0]).toMatchObject({
      operationId: 'assign-task',
      type: 'assign_task',
      ok: true,
      entityId: 'user-2',
      taskId: 'task-1',
    });
    expect(mocks.tx.taskAssignment.create).not.toHaveBeenCalled();
  });

  it('allows assistant comment deletion for comment authors or task owners', async () => {
    mocks.tx.comment.findFirst.mockResolvedValue({ id: 'comment-1', taskId: 'task-1' });
    mocks.tx.comment.delete.mockResolvedValue({ id: 'comment-1' });

    await executeApprovedDraft(userId, {
      schemaVersion: 1,
      summary: 'Delete a comment',
      operations: [
        {
          id: 'delete-comment',
          type: 'delete_comment',
          label: 'Delete comment',
          commentId: 'comment-1',
        },
      ],
    });

    expect(mocks.tx.comment.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'comment-1',
        OR: [
          { userId },
          {
            task: {
              userId,
            },
          },
        ],
      },
      select: {
        id: true,
        taskId: true,
      },
    });
    expect(mocks.tx.comment.delete).toHaveBeenCalledWith({
      where: {
        id: 'comment-1',
      },
    });
  });

  it('rejects delete_comment when the comment is not owned by the user', async () => {
    mocks.tx.comment.findFirst.mockResolvedValue(null);

    await expect(
      executeApprovedDraft(userId, {
        schemaVersion: 1,
        summary: 'Delete a comment',
        operations: [
          {
            id: 'delete-comment',
            type: 'delete_comment',
            label: 'Delete comment',
            commentId: 'comment-1',
          },
        ],
      }),
    ).rejects.toThrow(new DraftExecutionError('Comment not found'));
  });

  it('maps Prisma not-found errors to a user-facing execution error', async () => {
    mocks.tx.task.update.mockRejectedValue(prismaError('P2025'));

    await expect(
      executeApprovedDraft(userId, {
        schemaVersion: 1,
        summary: 'Update a task',
        operations: [
          {
            id: 'update-task',
            type: 'update_task',
            label: 'Update task',
            taskId: 'task-1',
            patch: {
              title: 'Updated',
            },
          },
        ],
      }),
    ).rejects.toThrow(new DraftExecutionError('Task or comment not found'));
  });

  it('maps Prisma relation errors to a user-facing execution error', async () => {
    mocks.tx.task.findFirst.mockResolvedValue({ id: 'task-1' });
    mocks.tx.task.delete.mockRejectedValue(prismaError('P2003'));

    await expect(
      executeApprovedDraft(userId, {
        schemaVersion: 1,
        summary: 'Delete a task',
        operations: [
          {
            id: 'delete-task',
            type: 'delete_task',
            label: 'Delete task',
            taskId: 'task-1',
          },
        ],
      }),
    ).rejects.toThrow(
      new DraftExecutionError('Delete failed because related comments, assignments, or tags still exist'),
    );
  });

  it('preserves unexpected Error messages', async () => {
    mocks.tx.task.findFirst.mockResolvedValue({ id: 'task-1' });
    mocks.tx.task.delete.mockRejectedValue(new Error('database down'));

    await expect(
      executeApprovedDraft(userId, {
        schemaVersion: 1,
        summary: 'Delete a task',
        operations: [
          {
            id: 'delete-task',
            type: 'delete_task',
            label: 'Delete task',
            taskId: 'task-1',
          },
        ],
      }),
    ).rejects.toThrow(new DraftExecutionError('database down'));
  });

  it('falls back when a non-Error value is thrown', async () => {
    mocks.prisma.$transaction.mockRejectedValue('no details');

    await expect(executeApprovedDraft(userId, fullDraft)).rejects.toThrow(
      new DraftExecutionError('Draft execution failed'),
    );
  });
});

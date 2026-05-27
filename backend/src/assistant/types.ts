import type { TaskPriority, TaskStatus } from '../constants/task';

export const ASSISTANT_MESSAGE_ROLE = {
  User: 'USER',
  Assistant: 'ASSISTANT',
  System: 'SYSTEM',
} as const;

export const ASSISTANT_DRAFT_STATUS = {
  Pending: 'PENDING',
  Superseded: 'SUPERSEDED',
  Executed: 'EXECUTED',
  Discarded: 'DISCARDED',
  Failed: 'FAILED',
} as const;

export type AssistantMessageRole =
  typeof ASSISTANT_MESSAGE_ROLE[keyof typeof ASSISTANT_MESSAGE_ROLE];

export type AssistantDraftStatus =
  typeof ASSISTANT_DRAFT_STATUS[keyof typeof ASSISTANT_DRAFT_STATUS];

export interface AssistantTaskInput {
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
}

export type AssistantTaskPatch = Partial<AssistantTaskInput>;

export interface AssistantCommentInput {
  content: string;
}

interface AssistantDraftOperationBase {
  id: string;
  label: string;
}

export interface CreateTaskDraftOperation extends AssistantDraftOperationBase {
  type: 'create_task';
  input: AssistantTaskInput;
}

export interface UpdateTaskDraftOperation extends AssistantDraftOperationBase {
  type: 'update_task';
  taskId: string;
  patch: AssistantTaskPatch;
}

export interface DeleteTaskDraftOperation extends AssistantDraftOperationBase {
  type: 'delete_task';
  taskId: string;
}

export interface AssignTaskDraftOperation extends AssistantDraftOperationBase {
  type: 'assign_task';
  taskId: string;
  userId: string;
}

export interface UnassignTaskDraftOperation extends AssistantDraftOperationBase {
  type: 'unassign_task';
  taskId: string;
  userId: string;
}

export interface CreateCommentDraftOperation extends AssistantDraftOperationBase {
  type: 'create_comment';
  taskId: string;
  input: AssistantCommentInput;
}

export interface DeleteCommentDraftOperation extends AssistantDraftOperationBase {
  type: 'delete_comment';
  commentId: string;
}

export type AssistantDraftOperation =
  | CreateTaskDraftOperation
  | UpdateTaskDraftOperation
  | DeleteTaskDraftOperation
  | AssignTaskDraftOperation
  | UnassignTaskDraftOperation
  | CreateCommentDraftOperation
  | DeleteCommentDraftOperation;

export interface AssistantDraftShape {
  schemaVersion: 1;
  summary: string;
  operations: AssistantDraftOperation[];
}

export interface AssistantModelResponse {
  schemaVersion: 1;
  message: string;
  draft: AssistantDraftShape | null;
}

export interface AssistantExecutionResult {
  ok: boolean;
  operations: Array<{
    operationId: string;
    type: AssistantDraftOperation['type'];
    ok: boolean;
    entityId?: string;
    taskId?: string;
    error?: string;
  }>;
}

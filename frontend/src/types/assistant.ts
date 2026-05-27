import type { CreateTaskInput, UpdateTaskInput } from './task';

export type AssistantMessageRole = 'USER' | 'ASSISTANT' | 'SYSTEM';
export type AssistantDraftStatus = 'PENDING' | 'EXECUTED' | 'DISCARDED' | 'FAILED';

interface AssistantDraftOperationBase {
  id: string;
  label: string;
}

export interface CreateTaskDraftOperation extends AssistantDraftOperationBase {
  type: 'create_task';
  input: CreateTaskInput;
}

export interface UpdateTaskDraftOperation extends AssistantDraftOperationBase {
  type: 'update_task';
  taskId: string;
  patch: UpdateTaskInput;
}

export interface DeleteTaskDraftOperation extends AssistantDraftOperationBase {
  type: 'delete_task';
  taskId: string;
}

export interface CreateCommentDraftOperation extends AssistantDraftOperationBase {
  type: 'create_comment';
  taskId: string;
  input: {
    content: string;
  };
}

export interface DeleteCommentDraftOperation extends AssistantDraftOperationBase {
  type: 'delete_comment';
  commentId: string;
}

export type AssistantDraftOperation =
  | CreateTaskDraftOperation
  | UpdateTaskDraftOperation
  | DeleteTaskDraftOperation
  | CreateCommentDraftOperation
  | DeleteCommentDraftOperation;

export interface AssistantDraftShape {
  schemaVersion: 1;
  summary: string;
  operations: AssistantDraftOperation[];
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

export interface AssistantDraftRecord {
  id: string;
  status: AssistantDraftStatus;
  originalDraft: AssistantDraftShape;
  approvedDraft: AssistantDraftShape | null;
  executionResult: AssistantExecutionResult | null;
  createdAt: string;
  updatedAt: string;
  decidedAt: string | null;
  executedAt: string | null;
}

export interface AssistantMessage {
  id: string;
  sequence: number;
  role: AssistantMessageRole;
  content: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  draft?: AssistantDraftRecord | null;
}

export interface AssistantChatListItem {
  id: string;
  title: string | null;
  summary: string | null;
  lastMessagePreview: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
}

export interface AssistantChat extends AssistantChatListItem {
  messages: AssistantMessage[];
}

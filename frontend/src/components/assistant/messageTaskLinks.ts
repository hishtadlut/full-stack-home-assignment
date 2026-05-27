import type { AssistantExecutionResult, AssistantMessage } from '../../types';

export interface AssistantTaskLink {
  taskId: string;
  label: string;
}

export const taskLinksForAssistantMessage = (message: AssistantMessage): AssistantTaskLink[] => {
  if (message.role !== 'ASSISTANT') {
    return [];
  }

  const executionResult = executionResultFromMetadata(message.metadata);

  if (!executionResult?.ok) {
    return [];
  }

  const linksByTaskId = new Map<string, AssistantTaskLink>();

  for (const operation of executionResult.operations) {
    if (!operation.ok || !isTaskLinkOperation(operation.type)) {
      continue;
    }

    const taskId = taskIdForOperation(operation);

    if (!taskId) {
      continue;
    }

    linksByTaskId.set(taskId, {
      taskId,
      label: labelForOperation(operation.type),
    });
  }

  return Array.from(linksByTaskId.values());
};

const executionResultFromMetadata = (
  metadata: AssistantMessage['metadata'],
): AssistantExecutionResult | null => {
  if (!isRecord(metadata) || !isExecutionResult(metadata.executionResult)) {
    return null;
  }

  return metadata.executionResult;
};

const isExecutionResult = (value: unknown): value is AssistantExecutionResult => {
  if (!isRecord(value) || typeof value.ok !== 'boolean' || !Array.isArray(value.operations)) {
    return false;
  }

  return value.operations.every(
    (operation) =>
      isRecord(operation) &&
      typeof operation.operationId === 'string' &&
      typeof operation.type === 'string' &&
      typeof operation.ok === 'boolean' &&
      (!('entityId' in operation) || typeof operation.entityId === 'string') &&
      (!('taskId' in operation) || typeof operation.taskId === 'string') &&
      (!('error' in operation) || typeof operation.error === 'string'),
  );
};

const isTaskLinkOperation = (type: string) =>
  type === 'create_task' ||
  type === 'update_task' ||
  type === 'create_comment' ||
  type === 'delete_comment';

const taskIdForOperation = (operation: AssistantExecutionResult['operations'][number]) => {
  if (operation.type === 'create_task' || operation.type === 'update_task') {
    return operation.taskId ?? operation.entityId ?? null;
  }

  return operation.taskId ?? null;
};

const labelForOperation = (type: AssistantExecutionResult['operations'][number]['type']) => {
  if (type === 'create_task') {
    return 'Open created task';
  }

  if (type === 'update_task') {
    return 'Open updated task';
  }

  if (type === 'create_comment') {
    return 'Open commented task';
  }

  return 'Open task';
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

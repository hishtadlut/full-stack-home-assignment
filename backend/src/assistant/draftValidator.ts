import {
  ASSISTANT_DRAFT_MAX_OPERATIONS,
  ASSISTANT_DRAFT_OPERATION_ID_MAX_LENGTH,
  ASSISTANT_DRAFT_OPERATION_TYPES,
  ASSISTANT_DRAFT_TASK_DESCRIPTION_MAX_LENGTH,
  ASSISTANT_DRAFT_TASK_TITLE_MAX_LENGTH,
  ASSISTANT_MESSAGE_MAX_LENGTH,
} from '../constants/assistant';
import { COMMENT_MAX_LENGTH } from '../constants/comment';
import { TASK_PRIORITIES, TASK_STATUSES } from '../constants/task';
import { hasField, hasText, hasValue, isOneOf, isRecord, isString } from '../middleware/validation';
import type {
  AssistantCommentInput,
  AssistantDraftOperation,
  AssistantDraftShape,
  AssistantModelResponse,
  AssistantTaskInput,
  AssistantTaskPatch,
} from './types';

export class DraftValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DraftValidationError';
  }
}

export const normalizeAssistantMessage = (value: unknown) => {
  if (!hasText(value)) {
    throw new DraftValidationError('Message is required');
  }

  const message = value.trim();

  if (message.length > ASSISTANT_MESSAGE_MAX_LENGTH) {
    throw new DraftValidationError(`Message must be ${ASSISTANT_MESSAGE_MAX_LENGTH} characters or fewer`);
  }

  return message;
};

export const parseJsonObject = (raw: string): unknown => {
  const trimmed = raw.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  return JSON.parse(withoutFence);
};

export const normalizeModelResponse = (value: unknown): AssistantModelResponse => {
  if (!isRecord(value)) {
    throw new DraftValidationError('Assistant response must be a JSON object');
  }

  return {
    schemaVersion: 1,
    message: normalizeAssistantResponseMessage(value.message),
    draft: value.draft === null || value.draft === undefined ? null : normalizeDraft(value.draft),
  };
};

export const normalizeDraft = (value: unknown): AssistantDraftShape => {
  if (!isRecord(value)) {
    throw new DraftValidationError('Draft must be a JSON object');
  }

  if (value.schemaVersion !== 1) {
    throw new DraftValidationError('Draft schemaVersion must be 1');
  }

  if (!hasText(value.summary)) {
    throw new DraftValidationError('Draft summary is required');
  }

  if (!Array.isArray(value.operations) || value.operations.length === 0) {
    throw new DraftValidationError('Draft must contain at least one operation');
  }

  if (value.operations.length > ASSISTANT_DRAFT_MAX_OPERATIONS) {
    throw new DraftValidationError(`Draft can contain at most ${ASSISTANT_DRAFT_MAX_OPERATIONS} operations`);
  }

  const usedIds = new Set<string>();

  return {
    schemaVersion: 1,
    summary: value.summary.trim(),
    operations: value.operations.map((operation, index) => normalizeOperation(operation, index, usedIds)),
  };
};

const normalizeAssistantResponseMessage = (value: unknown) => {
  if (!hasText(value)) {
    throw new DraftValidationError('Assistant message is required');
  }

  return value.trim();
};

const normalizeOperation = (
  value: unknown,
  index: number,
  usedIds: Set<string>,
): AssistantDraftOperation => {
  if (!isRecord(value)) {
    throw new DraftValidationError('Draft operation must be a JSON object');
  }

  if (!isOneOf(value.type, ASSISTANT_DRAFT_OPERATION_TYPES)) {
    throw new DraftValidationError('Draft operation type is invalid');
  }

  const id = normalizeOperationId(value.id, index, usedIds);
  const label = hasText(value.label) ? value.label.trim() : labelForType(value.type);

  switch (value.type) {
    case 'create_task':
      return {
        id,
        label,
        type: value.type,
        input: normalizeTaskInput(value.input),
      };

    case 'update_task':
      return {
        id,
        label,
        type: value.type,
        taskId: normalizeId(value.taskId, 'Task id is required'),
        patch: normalizeTaskPatch(value.patch),
      };

    case 'delete_task':
      return {
        id,
        label,
        type: value.type,
        taskId: normalizeId(value.taskId, 'Task id is required'),
      };

    case 'create_comment':
      return {
        id,
        label,
        type: value.type,
        taskId: normalizeId(value.taskId, 'Task id is required'),
        input: normalizeCommentInput(value.input),
      };

    case 'delete_comment':
      return {
        id,
        label,
        type: value.type,
        commentId: normalizeId(value.commentId, 'Comment id is required'),
      };
  }
};

const normalizeOperationId = (value: unknown, index: number, usedIds: Set<string>) => {
  const fallback = `operation_${index + 1}`;
  const rawId = hasText(value) ? value.trim() : fallback;
  const baseId = rawId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, ASSISTANT_DRAFT_OPERATION_ID_MAX_LENGTH) || fallback;
  let nextId = baseId;
  let suffix = 2;

  while (usedIds.has(nextId)) {
    nextId = `${baseId}_${suffix}`;
    suffix += 1;
  }

  usedIds.add(nextId);
  return nextId;
};

const normalizeTaskInput = (value: unknown): AssistantTaskInput => {
  if (!isRecord(value)) {
    throw new DraftValidationError('Task input must be a JSON object');
  }

  const title = normalizeRequiredText(value.title, 'Task title is required', ASSISTANT_DRAFT_TASK_TITLE_MAX_LENGTH);

  return {
    title,
    ...(hasField(value, 'description') && {
      description: normalizeOptionalText(
        value.description,
        'Task description',
        ASSISTANT_DRAFT_TASK_DESCRIPTION_MAX_LENGTH,
      ),
    }),
    ...(hasField(value, 'status') && {
      status: normalizeStatus(value.status),
    }),
    ...(hasField(value, 'priority') && {
      priority: normalizePriority(value.priority),
    }),
  };
};

const normalizeTaskPatch = (value: unknown): AssistantTaskPatch => {
  if (!isRecord(value)) {
    throw new DraftValidationError('Task patch must be a JSON object');
  }

  const patch: AssistantTaskPatch = {};

  if (hasField(value, 'title')) {
    patch.title = normalizeRequiredText(value.title, 'Task title is required', ASSISTANT_DRAFT_TASK_TITLE_MAX_LENGTH);
  }

  if (hasField(value, 'description')) {
    patch.description = normalizeOptionalText(
      value.description,
      'Task description',
      ASSISTANT_DRAFT_TASK_DESCRIPTION_MAX_LENGTH,
    );
  }

  if (hasField(value, 'status')) {
    patch.status = normalizeStatus(value.status);
  }

  if (hasField(value, 'priority')) {
    patch.priority = normalizePriority(value.priority);
  }

  if (Object.keys(patch).length === 0) {
    throw new DraftValidationError('Task update must contain at least one field');
  }

  return patch;
};

const normalizeCommentInput = (value: unknown): AssistantCommentInput => {
  if (!isRecord(value)) {
    throw new DraftValidationError('Comment input must be a JSON object');
  }

  return {
    content: normalizeRequiredText(value.content, 'Comment content is required', COMMENT_MAX_LENGTH),
  };
};

const normalizeRequiredText = (value: unknown, fieldLabel: string, maxLength: number) => {
  if (!hasText(value)) {
    throw new DraftValidationError(fieldLabel);
  }

  const text = value.trim();

  if (text.length > maxLength) {
    throw new DraftValidationError(`${fieldLabel} must be ${maxLength} characters or fewer`);
  }

  return text;
};

const normalizeOptionalText = (value: unknown, fieldLabel: string, maxLength: number) => {
  if (!hasValue(value)) {
    return null;
  }

  if (!isString(value)) {
    throw new DraftValidationError(`${fieldLabel} must be a string or null`);
  }

  if (value.length > maxLength) {
    throw new DraftValidationError(`${fieldLabel} must be ${maxLength} characters or fewer`);
  }

  return value;
};

const normalizeStatus = (value: unknown) => {
  if (!isOneOf(value, TASK_STATUSES)) {
    throw new DraftValidationError('Invalid task status');
  }

  return value;
};

const normalizePriority = (value: unknown) => {
  if (!isOneOf(value, TASK_PRIORITIES)) {
    throw new DraftValidationError('Invalid task priority');
  }

  return value;
};

const normalizeId = (value: unknown, errorMessage: string) => {
  if (!hasText(value)) {
    throw new DraftValidationError(errorMessage);
  }

  return value.trim();
};

const labelForType = (type: AssistantDraftOperation['type']) => {
  switch (type) {
    case 'create_task':
      return 'Create task';
    case 'update_task':
      return 'Update task';
    case 'delete_task':
      return 'Delete task';
    case 'create_comment':
      return 'Create comment';
    case 'delete_comment':
      return 'Delete comment';
  }
};

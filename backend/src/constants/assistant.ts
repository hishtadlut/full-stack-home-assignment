export const ASSISTANT_MODEL = 'gemini-3.5-flash';
export const ASSISTANT_EMPTY_CHAT_PREVIEW = 'Fresh assistant chat';
export const ASSISTANT_CHAT_LIST_LIMIT = 50;
export const ASSISTANT_CHAT_MESSAGE_LIMIT = 100;
export const ASSISTANT_MESSAGE_PREVIEW_LENGTH = 140;
export const ASSISTANT_RECENT_CONVERSATION_LIMIT = 30;
export const ASSISTANT_TASK_CONTEXT_LIMIT = 100;
export const ASSISTANT_TASK_CONTEXT_COMMENT_LIMIT = 20;
export const ASSISTANT_CHAT_TITLE_MAX_LENGTH = 48;
export const ASSISTANT_DRAFT_MAX_OPERATIONS = 10;
export const ASSISTANT_MESSAGE_MAX_LENGTH = 4000;
export const ASSISTANT_DRAFT_TASK_TITLE_MAX_LENGTH = 200;
export const ASSISTANT_DRAFT_TASK_DESCRIPTION_MAX_LENGTH = 2000;
export const ASSISTANT_DRAFT_OPERATION_ID_MAX_LENGTH = 64;
export const ASSISTANT_DRAFT_OPERATION_TYPES = [
  'create_task',
  'update_task',
  'delete_task',
  'create_comment',
  'delete_comment',
] as const;

export type AssistantDraftOperationType = typeof ASSISTANT_DRAFT_OPERATION_TYPES[number];

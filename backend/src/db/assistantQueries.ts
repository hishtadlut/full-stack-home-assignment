import type { Prisma } from '@prisma/client';
import {
  ASSISTANT_CHAT_MESSAGE_LIMIT,
  ASSISTANT_TASK_CONTEXT_COMMENT_LIMIT,
} from '../constants/assistant';

export const assistantChatListSelect = {
  id: true,
  title: true,
  summary: true,
  lastMessagePreview: true,
  messageCount: true,
  createdAt: true,
  updatedAt: true,
  lastMessageAt: true,
} as const satisfies Prisma.AssistantChatSelect;

export const assistantDraftSelect = {
  id: true,
  status: true,
  originalDraft: true,
  approvedDraft: true,
  executionResult: true,
  createdAt: true,
  updatedAt: true,
  decidedAt: true,
  executedAt: true,
} as const satisfies Prisma.AssistantDraftSelect;

export const assistantMessageWithDraftSelect = {
  id: true,
  sequence: true,
  role: true,
  content: true,
  metadata: true,
  createdAt: true,
  draft: {
    select: assistantDraftSelect,
  },
} as const satisfies Prisma.AssistantMessageSelect;

export const assistantChatSnapshotSelect = {
  ...assistantChatListSelect,
  messages: {
    orderBy: { sequence: 'asc' },
    take: ASSISTANT_CHAT_MESSAGE_LIMIT,
    select: assistantMessageWithDraftSelect,
  },
} as const satisfies Prisma.AssistantChatSelect;

export const assistantDraftDecisionSelect = {
  id: true,
  chatId: true,
  status: true,
} as const satisfies Prisma.AssistantDraftSelect;

export const assistantChatMessageCountSelect = {
  messageCount: true,
} as const satisfies Prisma.AssistantChatSelect;

export const assistantChatTitleSelect = {
  title: true,
} as const satisfies Prisma.AssistantChatSelect;

export const assistantRecentMessageSelect = {
  role: true,
  content: true,
  createdAt: true,
} as const satisfies Prisma.AssistantMessageSelect;

const assistantContextUserSelect = {
  id: true,
  username: true,
  name: true,
} as const satisfies Prisma.UserSelect;

const assistantTaskContextCommentSelect = {
  id: true,
  content: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: assistantContextUserSelect,
  },
} as const satisfies Prisma.CommentSelect;

export const assistantTaskContextSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  createdAt: true,
  updatedAt: true,
  comments: {
    orderBy: { createdAt: 'desc' },
    take: ASSISTANT_TASK_CONTEXT_COMMENT_LIMIT,
    select: assistantTaskContextCommentSelect,
  },
} as const satisfies Prisma.TaskSelect;

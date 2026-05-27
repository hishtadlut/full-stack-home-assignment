import { Prisma } from '@prisma/client';
import {
  ASSISTANT_CHAT_LIST_LIMIT,
  ASSISTANT_CHAT_TITLE_MAX_LENGTH,
  ASSISTANT_EMPTY_CHAT_PREVIEW,
  ASSISTANT_MESSAGE_PREVIEW_LENGTH,
  ASSISTANT_MODEL,
  ASSISTANT_RECENT_CONVERSATION_LIMIT,
  ASSISTANT_TASK_CONTEXT_LIMIT,
} from '../constants/assistant';
import {
  assistantChatListSelect,
  assistantChatMessageCountSelect,
  assistantChatSnapshotSelect,
  assistantChatTitleSelect,
  assistantDraftDecisionSelect,
  assistantRecentMessageSelect,
  assistantTaskContextSelect,
} from '../db/assistantQueries';
import { prisma, type TransactionClient } from '../db/prisma';
import { idSelect } from '../db/selects';
import {
  ASSISTANT_DRAFT_STATUS,
  ASSISTANT_MESSAGE_ROLE,
  type AssistantDraftShape,
  type AssistantExecutionResult,
  type AssistantMessageRole,
} from './types';

export const createAssistantChat = async (userId: string) =>
  prisma.assistantChat.create({
    data: {
      userId,
      title: 'New chat',
      lastMessagePreview: ASSISTANT_EMPTY_CHAT_PREVIEW,
    },
  });

export const listAssistantChats = async (userId: string) =>
  prisma.assistantChat.findMany({
    where: { userId },
    orderBy: { lastMessageAt: 'desc' },
    take: ASSISTANT_CHAT_LIST_LIMIT,
    select: assistantChatListSelect,
  });

export const getAssistantChatForUser = async (userId: string, chatId: string) =>
  prisma.assistantChat.findFirst({
    where: {
      id: chatId,
      userId,
    },
    select: idSelect,
  });

export const getAssistantChatSnapshot = async (userId: string, chatId: string) => {
  const chat = await prisma.assistantChat.findFirst({
    where: {
      id: chatId,
      userId,
    },
    select: assistantChatSnapshotSelect,
  });

  return chat;
};

export const hasPendingDraft = async (chatId: string) => {
  const draft = await prisma.assistantDraft.findFirst({
    where: {
      chatId,
      status: 'PENDING',
    },
    select: idSelect,
  });

  return Boolean(draft);
};

export const findAssistantDraftForUser = (userId: string, draftId: string) =>
  prisma.assistantDraft.findFirst({
    where: {
      id: draftId,
      chat: {
        userId,
      },
    },
    select: assistantDraftDecisionSelect,
  });

export const appendAssistantMessage = async (
  tx: TransactionClient,
  chatId: string,
  role: AssistantMessageRole,
  content: string,
  metadata?: Prisma.InputJsonValue,
) => {
  const now = new Date();
  const chat = await tx.assistantChat.update({
    where: { id: chatId },
    data: {
      messageCount: {
        increment: 1,
      },
      lastMessageAt: now,
      lastMessagePreview: previewFor(content),
    },
    select: assistantChatMessageCountSelect,
  });

  return tx.assistantMessage.create({
    data: {
      chatId,
      sequence: chat.messageCount,
      role,
      content,
      metadata,
      createdAt: now,
    },
  });
};

export const appendUserMessage = async (chatId: string, content: string) =>
  prisma.$transaction((tx) => appendAssistantMessage(tx, chatId, ASSISTANT_MESSAGE_ROLE.User, content));

export const appendAssistantModelResponse = async (
  chatId: string,
  message: string,
  draft: AssistantDraftShape | null,
) => {
  await prisma.$transaction(async (tx) => {
    const assistantMessage = await appendAssistantMessage(
      tx,
      chatId,
      ASSISTANT_MESSAGE_ROLE.Assistant,
      message,
      {
        model: ASSISTANT_MODEL,
        hasDraft: Boolean(draft),
      },
    );

    if (draft) {
      await tx.assistantDraft.create({
        data: {
          chatId,
          assistantMessageId: assistantMessage.id,
          status: ASSISTANT_DRAFT_STATUS.Pending,
          originalDraft: draft as unknown as Prisma.InputJsonValue,
        },
      });
    }
  });
};

export const markAssistantDraftDiscarded = async (draftId: string, chatId: string) => {
  await prisma.$transaction(async (tx) => {
    await tx.assistantDraft.update({
      where: { id: draftId },
      data: {
        status: ASSISTANT_DRAFT_STATUS.Discarded,
        decidedAt: new Date(),
      },
    });

    await appendAssistantMessage(
      tx,
      chatId,
      ASSISTANT_MESSAGE_ROLE.Assistant,
      'Draft discarded. Tell me what you want to do next.',
      {
        draftId,
        action: 'discarded',
      },
    );
  });
};

export const markAssistantDraftExecuted = async (
  draftId: string,
  chatId: string,
  approvedDraft: AssistantDraftShape,
  executionResult: AssistantExecutionResult,
) => {
  await prisma.$transaction(async (tx) => {
    await tx.assistantDraft.update({
      where: { id: draftId },
      data: {
        status: ASSISTANT_DRAFT_STATUS.Executed,
        approvedDraft: approvedDraft as unknown as Prisma.InputJsonValue,
        executionResult: executionResult as unknown as Prisma.InputJsonValue,
        decidedAt: new Date(),
        executedAt: new Date(),
      },
    });

    await appendAssistantMessage(
      tx,
      chatId,
      ASSISTANT_MESSAGE_ROLE.Assistant,
      'Done. I applied the approved changes.',
      {
        draftId,
        action: 'executed',
        executionResult: executionResult as unknown as Prisma.InputJsonValue,
      },
    );
  });
};

export const markAssistantDraftFailed = async (
  draftId: string,
  chatId: string,
  approvedDraft: AssistantDraftShape,
  executionResult: AssistantExecutionResult,
  message: string,
) => {
  await prisma.$transaction(async (tx) => {
    await tx.assistantDraft.update({
      where: { id: draftId },
      data: {
        status: ASSISTANT_DRAFT_STATUS.Failed,
        approvedDraft: approvedDraft as unknown as Prisma.InputJsonValue,
        executionResult: executionResult as unknown as Prisma.InputJsonValue,
        decidedAt: new Date(),
      },
    });

    await appendAssistantMessage(
      tx,
      chatId,
      ASSISTANT_MESSAGE_ROLE.Assistant,
      `I could not apply the draft: ${message}`,
      {
        draftId,
        action: 'failed',
        executionResult: executionResult as unknown as Prisma.InputJsonValue,
      },
    );
  });
};

export const maybeTitleChatFromMessage = async (chatId: string, message: string) => {
  const chat = await prisma.assistantChat.findUnique({
    where: { id: chatId },
    select: assistantChatTitleSelect,
  });

  if (!chat || (chat.title && chat.title !== 'New chat')) {
    return;
  }

  await prisma.assistantChat.update({
    where: { id: chatId },
    data: {
      title: titleFromMessage(message),
    },
  });
};

export const getRecentConversationForModel = async (chatId: string) =>
  prisma.assistantMessage.findMany({
    where: { chatId },
    orderBy: { sequence: 'desc' },
    take: ASSISTANT_RECENT_CONVERSATION_LIMIT,
    select: assistantRecentMessageSelect,
  });

export const getTaskContextForAssistant = async (userId: string) => {
  const tasks = await prisma.task.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    take: ASSISTANT_TASK_CONTEXT_LIMIT,
    select: assistantTaskContextSelect,
  });

  return tasks;
};

const previewFor = (content: string) => {
  const compact = content.replace(/\s+/g, ' ').trim();
  return compact.length > ASSISTANT_MESSAGE_PREVIEW_LENGTH
    ? `${compact.slice(0, ASSISTANT_MESSAGE_PREVIEW_LENGTH - 1)}...`
    : compact;
};

const titleFromMessage = (message: string) => {
  const compact = message.replace(/\s+/g, ' ').trim();
  const title = compact.length > ASSISTANT_CHAT_TITLE_MAX_LENGTH
    ? `${compact.slice(0, ASSISTANT_CHAT_TITLE_MAX_LENGTH - 1)}...`
    : compact;
  return title || 'New chat';
};

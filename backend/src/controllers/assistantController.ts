import { Response } from 'express';
import {
  normalizeAssistantMessage,
  normalizeDraft,
  DraftValidationError,
} from '../assistant/draftValidator';
import { executeApprovedDraft, DraftExecutionError } from '../assistant/executor';
import { generateAssistantResponse } from '../assistant/geminiAssistant';
import {
  appendAssistantModelResponse,
  appendUserMessage,
  createAssistantChat,
  findAssistantDraftForUser,
  getAssistantChatForUser,
  getAssistantChatSnapshot,
  getRecentConversationForModel,
  getTaskContextForAssistant,
  hasPendingDraft,
  listAssistantChats,
  markAssistantDraftDiscarded,
  markAssistantDraftExecuted,
  markAssistantDraftFailed,
  maybeTitleChatFromMessage,
} from '../assistant/repository';
import {
  ASSISTANT_DRAFT_STATUS,
  type AssistantDraftShape,
  type AssistantExecutionResult,
} from '../assistant/types';
import { AuthRequest } from '../middleware/auth';
import { hasField, hasText, isRecord } from '../middleware/validation';

export const listChats = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const chats = await listAssistantChats(userId);

    res.json({ chats });
  } catch (error) {
    console.error('Error listing assistant chats:', error);
    res.status(500).json({ error: 'Failed to list assistant chats' });
  }
};

export const createChat = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const chat = await createAssistantChat(userId);

    res.status(201).json({ chat });
  } catch (error) {
    console.error('Error creating assistant chat:', error);
    res.status(500).json({ error: 'Failed to create assistant chat' });
  }
};

export const getChat = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { chatId } = req.params;

    if (!hasText(chatId)) {
      return res.status(400).json({ error: 'Chat id is required' });
    }

    const chat = await getAssistantChatSnapshot(userId, chatId);

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    res.json({ chat });
  } catch (error) {
    console.error('Error fetching assistant chat:', error);
    res.status(500).json({ error: 'Failed to fetch assistant chat' });
  }
};

export const sendMessage = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { chatId } = req.params;

    if (!hasText(chatId)) {
      return res.status(400).json({ error: 'Chat id is required' });
    }

    const chat = await getAssistantChatForUser(userId, chatId);

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    if (!isRecord(req.body)) {
      return res.status(400).json({ error: 'Request body must be a JSON object' });
    }

    let message: string;

    try {
      message = normalizeAssistantMessage(req.body.message);
    } catch (error) {
      if (error instanceof DraftValidationError) {
        return res.status(400).json({ error: error.message });
      }

      throw error;
    }

    if (await hasPendingDraft(chatId)) {
      return res.status(409).json({ error: 'Resolve the pending draft before sending another message' });
    }

    await appendUserMessage(chatId, message);
    await maybeTitleChatFromMessage(chatId, message);

    const [recentMessages, taskContext] = await Promise.all([
      getRecentConversationForModel(chatId),
      getTaskContextForAssistant(userId),
    ]);

    const modelResponse = await callAssistantModel(message, recentMessages, taskContext);

    await appendAssistantModelResponse(chatId, modelResponse.message, modelResponse.draft);

    const snapshot = await getAssistantChatSnapshot(userId, chatId);
    res.status(201).json({ chat: snapshot });
  } catch (error) {
    if (error instanceof AssistantProviderError) {
      console.error('Assistant provider error:', error);
      return res.status(502).json({ error: error.message });
    }

    console.error('Error sending assistant message:', error);
    res.status(500).json({ error: 'Failed to send assistant message' });
  }
};

export const updateDraft = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { draftId } = req.params;

    if (!hasText(draftId)) {
      return res.status(400).json({ error: 'Draft id is required' });
    }

    if (!isRecord(req.body)) {
      return res.status(400).json({ error: 'Request body must be a JSON object' });
    }

    const decision = parseDraftUpdateBody(req.body);

    const draft = await findAssistantDraftForUser(userId, draftId);

    if (!draft) {
      return res.status(404).json({ error: 'Draft not found' });
    }

    if (draft.status !== ASSISTANT_DRAFT_STATUS.Pending) {
      return res.status(409).json({ error: 'Draft is no longer pending' });
    }

    if (decision.status === ASSISTANT_DRAFT_STATUS.Discarded) {
      await markAssistantDraftDiscarded(draft.id, draft.chatId);

      const snapshot = await getAssistantChatSnapshot(userId, draft.chatId);
      return res.json({ chat: snapshot });
    }

    try {
      const executionResult = await executeApprovedDraft(userId, decision.approvedDraft);

      await markAssistantDraftExecuted(draft.id, draft.chatId, decision.approvedDraft, executionResult);

      const snapshot = await getAssistantChatSnapshot(userId, draft.chatId);
      return res.json({ chat: snapshot, executionResult });
    } catch (error) {
      if (!(error instanceof DraftExecutionError)) {
        throw error;
      }

      const executionResult = failedExecutionResult(decision.approvedDraft, error.message);

      await markAssistantDraftFailed(draft.id, draft.chatId, decision.approvedDraft, executionResult, error.message);

      const snapshot = await getAssistantChatSnapshot(userId, draft.chatId);
      return res.status(409).json({ chat: snapshot, executionResult, error: error.message });
    }
  } catch (error) {
    if (error instanceof DraftValidationError) {
      return res.status(400).json({ error: error.message });
    }

    console.error('Error updating assistant draft:', error);
    res.status(500).json({ error: 'Failed to update assistant draft' });
  }
};

const callAssistantModel = async (
  message: string,
  recentMessages: Awaited<ReturnType<typeof getRecentConversationForModel>>,
  taskContext: Awaited<ReturnType<typeof getTaskContextForAssistant>>,
) => {
  try {
    return await generateAssistantResponse({
      userMessage: message,
      recentMessages,
      taskContext,
    });
  } catch (error) {
    if (error instanceof DraftValidationError) {
      throw new AssistantProviderError(`Assistant returned an invalid draft: ${error.message}`);
    }

    throw new AssistantProviderError('Assistant provider request failed');
  }
};

class AssistantProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssistantProviderError';
  }
}

const parseDraftUpdateBody = (body: Record<string, unknown>) => {
  if (body.status === ASSISTANT_DRAFT_STATUS.Discarded) {
    if (hasField(body, 'approvedDraft')) {
      throw new DraftValidationError('Discarding a draft must not include approvedDraft');
    }

    return {
      status: ASSISTANT_DRAFT_STATUS.Discarded,
    } as const;
  }

  if (body.status === ASSISTANT_DRAFT_STATUS.Executed) {
    if (!hasField(body, 'approvedDraft')) {
      throw new DraftValidationError('approvedDraft is required when executing a draft');
    }

    return {
      status: ASSISTANT_DRAFT_STATUS.Executed,
      approvedDraft: normalizeDraft(body.approvedDraft),
    } as const;
  }

  throw new DraftValidationError('Draft status must be EXECUTED or DISCARDED');
};

const failedExecutionResult = (
  approvedDraft: AssistantDraftShape,
  message: string,
): AssistantExecutionResult => ({
  ok: false,
  operations: approvedDraft.operations.map((operation) => ({
    operationId: operation.id,
    type: operation.type,
    ok: false,
    error: message,
  })),
});

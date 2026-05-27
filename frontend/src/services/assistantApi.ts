import { api, ApiRequestError } from './api';
import type { AssistantChat, AssistantChatListItem, AssistantDraftShape, AssistantExecutionResult } from '../types';

interface ExecuteDraftResponse {
  chat: AssistantChat;
  executionResult: AssistantExecutionResult;
  error?: string;
}

export const assistantApi = {
  async listChats() {
    return api.get<{ chats: AssistantChatListItem[] }>('/assistant/chats');
  },

  async createChat() {
    return api.post<{ chat: AssistantChatListItem }>('/assistant/chats', {});
  },

  async getChat(chatId: string) {
    return api.get<{ chat: AssistantChat }>(`/assistant/chats/${chatId}`);
  },

  async sendMessage(chatId: string, message: string) {
    return api.post<{ chat: AssistantChat }>(`/assistant/chats/${chatId}/messages`, { message });
  },

  async executeDraft(draftId: string, approvedDraft: AssistantDraftShape): Promise<ExecuteDraftResponse> {
    try {
      return await api.patch<ExecuteDraftResponse>(`/assistant/drafts/${draftId}`, {
        status: 'EXECUTED',
        approvedDraft,
      });
    } catch (error) {
      if (
        error instanceof ApiRequestError &&
        error.status === 409 &&
        isExecuteDraftResponse(error.body)
      ) {
        return error.body;
      }

      throw error;
    }
  },

  async discardDraft(draftId: string) {
    return api.patch<{ chat: AssistantChat }>(`/assistant/drafts/${draftId}`, {
      status: 'DISCARDED',
    });
  },
};

const isExecuteDraftResponse = (value: unknown): value is ExecuteDraftResponse =>
  isRecord(value) && isRecord(value.chat) && isRecord(value.executionResult);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

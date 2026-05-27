import { api } from './api';
import type { AssistantChat, AssistantChatListItem, AssistantDraftShape, AssistantExecutionResult } from '../types';

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

  async executeDraft(draftId: string, approvedDraft: AssistantDraftShape) {
    return api.patch<{ chat: AssistantChat; executionResult: AssistantExecutionResult }>(`/assistant/drafts/${draftId}`, {
      status: 'EXECUTED',
      approvedDraft,
    });
  },

  async discardDraft(draftId: string) {
    return api.patch<{ chat: AssistantChat }>(`/assistant/drafts/${draftId}`, {
      status: 'DISCARDED',
    });
  },
};

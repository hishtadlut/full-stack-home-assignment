import { useCallback, useMemo, useState } from 'react';
import { assistantApi } from '../services/assistantApi';
import type { AssistantChat, AssistantChatListItem, AssistantDraftRecord } from '../types';

interface UseAssistantChatOptions {
  onTasksChanged: () => Promise<void> | void;
}

export const useAssistantChat = ({ onTasksChanged }: UseAssistantChatOptions) => {
  const [chats, setChats] = useState<AssistantChatListItem[]>([]);
  const [chat, setChat] = useState<AssistantChat | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const pendingDraft = useMemo<AssistantDraftRecord | null>(
    () => chat?.messages.find((message) => message.draft?.status === 'PENDING')?.draft ?? null,
    [chat],
  );

  const refreshChatList = useCallback(async () => {
    const list = await assistantApi.listChats();
    setChats(list.chats);
    return list.chats;
  }, []);

  const openChat = useCallback(async (chatId: string) => {
    const response = await assistantApi.getChat(chatId);
    setChat(response.chat);
    return response.chat;
  }, []);

  const startFreshChat = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const created = await assistantApi.createChat();
      const nextChat = await openChat(created.chat.id);
      setInput('');
      await refreshChatList();
      return nextChat;
    } catch (createError) {
      setError(messageForError(createError));
      return null;
    } finally {
      setLoading(false);
    }
  }, [openChat, refreshChatList]);

  const loadInitialChat = useCallback(async () => {
    if (chat) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const list = await assistantApi.listChats();
      setChats(list.chats);

      if (list.chats.length > 0) {
        await openChat(list.chats[0].id);
        return;
      }

      const created = await assistantApi.createChat();
      await openChat(created.chat.id);
      await refreshChatList();
    } catch (loadError) {
      setError(messageForError(loadError));
    } finally {
      setLoading(false);
    }
  }, [chat, openChat, refreshChatList]);

  const selectChat = useCallback(async (chatId: string) => {
    setLoading(true);
    setError(null);

    try {
      await openChat(chatId);
      await refreshChatList();
    } catch (loadError) {
      setError(messageForError(loadError));
    } finally {
      setLoading(false);
    }
  }, [openChat, refreshChatList]);

  const sendMessage = useCallback(async (rawMessage: string) => {
    const message = rawMessage.trim();

    if (!message || sending || pendingDraft) {
      return;
    }

    setSending(true);
    setError(null);
    setInput('');

    try {
      let activeChat = chat;

      if (!activeChat) {
        const created = await assistantApi.createChat();
        activeChat = await openChat(created.chat.id);
      }

      const response = await assistantApi.sendMessage(activeChat.id, message);
      setChat(response.chat);
      await refreshChatList();
    } catch (sendError) {
      setError(messageForError(sendError));
      setInput(message);
    } finally {
      setSending(false);
    }
  }, [chat, openChat, pendingDraft, refreshChatList, sending]);

  const handleDraftExecuted = useCallback(async (updatedChat: AssistantChat) => {
    setChat(updatedChat);
    await refreshChatList();
    await onTasksChanged();
  }, [onTasksChanged, refreshChatList]);

  const handleDraftDiscarded = useCallback(async (updatedChat: AssistantChat) => {
    setChat(updatedChat);
    await refreshChatList();
  }, [refreshChatList]);

  return {
    chats,
    chat,
    loading,
    sending,
    input,
    error,
    pendingDraft,
    setInput,
    loadInitialChat,
    selectChat,
    startFreshChat,
    sendMessage,
    handleDraftExecuted,
    handleDraftDiscarded,
  };
};

const messageForError = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong';
};

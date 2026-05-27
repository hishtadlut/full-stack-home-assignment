import { useEffect, useState, type FormEvent } from 'react';
import { AssistantConversation } from './assistant/AssistantConversation';
import { ChatHistory } from './assistant/ChatHistory';
import { useAssistantChat } from '../hooks/useAssistantChat';

interface AssistantPanelProps {
  onTasksChanged: () => Promise<void> | void;
}

export const AssistantPanel = ({ onTasksChanged }: AssistantPanelProps) => {
  const [open, setOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const {
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
  } = useAssistantChat({ onTasksChanged });

  useEffect(() => {
    if (open) {
      void loadInitialChat();
    }
  }, [open, loadInitialChat]);

  const handleSelectChat = async (chatId: string) => {
    await selectChat(chatId);
    setHistoryOpen(false);
  };

  const handleStartFreshChat = async () => {
    await startFreshChat();
    setHistoryOpen(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await sendMessage(input);
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 left-6 z-50 h-16 w-16 rounded-full border-4 border-white bg-cyan-600 text-white shadow-xl shadow-cyan-900/25 transition hover:-translate-y-1 hover:bg-cyan-700 focus:outline-none focus:ring-4 focus:ring-cyan-300"
          aria-label="Open task assistant"
          aria-controls="task-assistant-panel"
          aria-expanded={open}
        >
          <span className="block text-lg font-black tracking-normal">AI</span>
          <span className="absolute -right-1 -top-1 h-4 w-4 rounded-full border-2 border-white bg-lime-400" />
        </button>
      )}

      {open && (
        <section
          id="task-assistant-panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby="task-assistant-title"
          className="fixed bottom-4 left-4 z-50 flex h-[min(44rem,calc(100vh-2rem))] w-[min(58rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xl"
        >
          {historyOpen && (
            <aside className="hidden w-72 shrink-0 border-r border-gray-200 bg-gray-50 md:block">
              <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                <h3 className="text-sm font-semibold text-gray-900">Old chats</h3>
                <button
                  type="button"
                  onClick={() => void handleStartFreshChat()}
                  className="rounded border border-cyan-200 px-2 py-1 text-xs font-semibold text-cyan-700 hover:bg-cyan-50"
                >
                  Clean new chat
                </button>
              </div>
              <ChatHistory chats={chats} activeChatId={chat?.id ?? null} onSelect={handleSelectChat} />
            </aside>
          )}

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-normal text-cyan-700">Task assistant</p>
                <h2 id="task-assistant-title" className="truncate text-base font-bold text-gray-900">
                  {chat?.title || 'New chat'}
                </h2>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setHistoryOpen((current) => !current)}
                  className="rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  aria-controls="task-assistant-history"
                  aria-expanded={historyOpen}
                >
                  History
                </button>
                <button
                  type="button"
                  onClick={() => void handleStartFreshChat()}
                  className="rounded border border-cyan-200 px-3 py-2 text-sm font-semibold text-cyan-700 hover:bg-cyan-50"
                >
                  Clean new chat
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  aria-label="Close task assistant"
                >
                  Close
                </button>
              </div>
            </header>

            {historyOpen && (
              <div id="task-assistant-history" className="border-b border-gray-200 bg-gray-50 md:hidden">
                <ChatHistory chats={chats} activeChatId={chat?.id ?? null} onSelect={handleSelectChat} />
              </div>
            )}

            <AssistantConversation
              chat={chat}
              loading={loading}
              sending={sending}
              className="min-h-0 flex-1 overflow-y-auto bg-slate-50 px-4 py-4"
              onExecuted={handleDraftExecuted}
              onDiscarded={handleDraftDiscarded}
            />

            {error && (
              <div role="alert" className="border-t border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="border-t border-gray-200 bg-white p-3">
              {pendingDraft && (
                <p id="task-assistant-pending-draft" className="mb-2 text-xs font-medium text-amber-700">
                  Resolve the pending draft before sending another message.
                </p>
              )}
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  disabled={sending || Boolean(pendingDraft)}
                  aria-label="Message task assistant"
                  aria-describedby={pendingDraft ? 'task-assistant-pending-draft' : undefined}
                  placeholder="Ask me to find, create, update, or delete tasks..."
                  className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100 disabled:bg-gray-100"
                />
                <button
                  type="submit"
                  disabled={sending || Boolean(pendingDraft) || input.trim().length === 0}
                  className="rounded bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  Send
                </button>
              </div>
            </form>
          </div>
        </section>
      )}
    </>
  );
};

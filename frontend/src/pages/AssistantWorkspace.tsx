import { useEffect, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Bot, MessageSquarePlus, Send } from 'lucide-react';
import { AssistantConversation } from '../components/assistant/AssistantConversation';
import { ChatHistory } from '../components/assistant/ChatHistory';
import { useAssistantChat } from '../hooks/useAssistantChat';

export const AssistantWorkspace = () => {
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
  } = useAssistantChat({ onTasksChanged: async () => undefined });

  useEffect(() => {
    void loadInitialChat();
  }, [loadInitialChat]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await sendMessage(input);
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <Link to="/dashboard" className="inline-flex w-max items-center gap-2 text-sm font-semibold text-zinc-700 hover:text-cyan-700">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Dashboard
          </Link>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-cyan-700">
                <Bot className="h-4 w-4" aria-hidden="true" />
                Assistant workspace
              </p>
              <h1 className="mt-1 text-3xl font-bold tracking-normal">Task assistant</h1>
            </div>
            <button
              type="button"
              onClick={() => void startFreshChat()}
              className="inline-flex items-center gap-2 rounded bg-zinc-950 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
            >
              <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
              New Chat
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-4 px-4 py-6 sm:px-6 lg:grid-cols-[20rem_minmax(0,1fr)] lg:px-8">
        <aside className="rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 px-4 py-3">
            <h2 className="text-sm font-bold text-zinc-950">Chat history</h2>
          </div>
          <ChatHistory chats={chats} activeChatId={chat?.id ?? null} onSelect={selectChat} />
        </aside>

        <section className="flex min-h-[38rem] flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-normal text-cyan-700">Active chat</p>
              <h2 className="truncate text-lg font-bold text-zinc-950">{chat?.title || 'New chat'}</h2>
            </div>
            {pendingDraft && (
              <span className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800">
                Pending draft
              </span>
            )}
          </header>

          <AssistantConversation
            chat={chat}
            loading={loading}
            sending={sending}
            className="min-h-0 flex-1 overflow-y-auto bg-zinc-50 px-4 py-4"
            loadingClassName="text-sm text-zinc-600"
            sendingClassName="mt-3 max-w-[80%] rounded-lg bg-white px-4 py-3 text-sm text-zinc-600 shadow-sm"
            onExecuted={handleDraftExecuted}
            onDiscarded={handleDraftDiscarded}
          />

          {error && (
            <div role="alert" className="border-t border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="border-t border-zinc-200 bg-white p-4">
            {pendingDraft && (
              <p id="assistant-page-pending-draft" className="mb-2 text-xs font-semibold text-amber-700">
                Resolve the pending draft before sending another message.
              </p>
            )}
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                disabled={sending || Boolean(pendingDraft)}
                rows={3}
                aria-label="Message task assistant"
                aria-describedby={pendingDraft ? 'assistant-page-pending-draft' : undefined}
                placeholder="Message task assistant..."
                className="min-w-0 resize-none rounded border border-zinc-300 px-3 py-2 text-sm focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-100 disabled:bg-zinc-100"
              />
              <button
                type="submit"
                disabled={sending || Boolean(pendingDraft) || input.trim().length === 0}
                className="inline-flex items-center justify-center gap-2 rounded bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
                Send
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
};

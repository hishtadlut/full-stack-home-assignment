import { useEffect, useRef } from 'react';
import type { AssistantChat } from '../../types';
import { MessageBubble } from './MessageBubble';
import { WelcomeMessage } from './WelcomeMessage';

interface AssistantConversationProps {
  chat: AssistantChat | null;
  loading: boolean;
  sending: boolean;
  className: string;
  loadingClassName?: string;
  sendingClassName?: string;
  onExecuted: (chat: AssistantChat) => Promise<void>;
  onDiscarded: (chat: AssistantChat) => Promise<void>;
}

export const AssistantConversation = ({
  chat,
  loading,
  sending,
  className,
  loadingClassName = 'text-sm text-gray-600',
  sendingClassName = 'mt-3 max-w-[80%] rounded-lg bg-white px-4 py-3 text-sm text-gray-600 shadow-sm',
  onExecuted,
  onDiscarded,
}: AssistantConversationProps) => {
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chat?.messages.length, sending]);

  return (
    <div
      className={className}
      role="log"
      aria-live="polite"
      aria-relevant="additions text"
      aria-busy={loading || sending}
    >
      {loading && (
        <div role="status" className={loadingClassName}>
          Loading assistant...
        </div>
      )}

      {!loading && (!chat || chat.messages.length === 0) && <WelcomeMessage />}

      {!loading && chat?.messages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          onExecuted={onExecuted}
          onDiscarded={onDiscarded}
        />
      ))}

      {sending && (
        <div role="status" className={sendingClassName}>
          Drafting a careful answer...
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
};

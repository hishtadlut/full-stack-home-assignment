import type { AssistantChatListItem } from '../../types';

interface ChatHistoryProps {
  chats: AssistantChatListItem[];
  activeChatId: string | null;
  onSelect: (chatId: string) => Promise<void>;
}

export const ChatHistory = ({ chats, activeChatId, onSelect }: ChatHistoryProps) => {
  const groupedChats = groupChatsByDate(chats);

  if (chats.length === 0) {
    return (
      <div role="status" className="p-4 text-sm text-gray-500">
        No saved chats yet.
      </div>
    );
  }

  return (
    <nav aria-label="Assistant chat history" className="max-h-80 overflow-y-auto p-2 md:max-h-none">
      {groupedChats.map((group) => (
        <div key={group.label} className="mb-3">
          <p className="px-2 py-1 text-xs font-semibold uppercase tracking-normal text-gray-500">{group.label}</p>
          <div className="space-y-1">
            {group.chats.map((chat) => (
              <button
                type="button"
                key={chat.id}
                onClick={() => void onSelect(chat.id)}
                aria-current={chat.id === activeChatId ? 'true' : undefined}
                className={`w-full rounded px-3 py-2 text-left text-sm transition ${
                  chat.id === activeChatId
                    ? 'bg-cyan-100 text-cyan-950'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="block truncate font-semibold">{chat.title || 'New chat'}</span>
                <span className="block truncate text-xs text-gray-500">
                  {chat.lastMessagePreview}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
};

const groupChatsByDate = (chats: AssistantChatListItem[]) => {
  const now = new Date();
  const today = now.toDateString();
  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(now.getDate() - 1);
  const yesterday = yesterdayDate.toDateString();

  const groups: Array<{ label: string; chats: AssistantChatListItem[] }> = [
    { label: 'Today', chats: [] },
    { label: 'Yesterday', chats: [] },
    { label: 'Earlier', chats: [] },
  ];

  for (const chat of chats) {
    const date = new Date(chat.lastMessageAt).toDateString();

    if (date === today) {
      groups[0].chats.push(chat);
    } else if (date === yesterday) {
      groups[1].chats.push(chat);
    } else {
      groups[2].chats.push(chat);
    }
  }

  return groups.filter((group) => group.chats.length > 0);
};

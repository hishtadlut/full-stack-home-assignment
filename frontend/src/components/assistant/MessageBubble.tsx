import { Link } from 'react-router-dom';
import type { AssistantChat, AssistantMessage } from '../../types';
import { DraftCard } from './DraftCard';
import { taskLinksForAssistantMessage } from './messageTaskLinks';

interface MessageBubbleProps {
  message: AssistantMessage;
  onExecuted: (chat: AssistantChat) => Promise<void>;
  onDiscarded: (chat: AssistantChat) => Promise<void>;
}

export const MessageBubble = ({ message, onExecuted, onDiscarded }: MessageBubbleProps) => {
  const isUser = message.role === 'USER';
  const taskLinks = taskLinksForAssistantMessage(message);
  const bubbleClassName = `rounded-lg px-4 py-3 text-sm shadow-sm ${
    isUser
      ? 'bg-cyan-700 text-white'
      : 'border border-gray-200 bg-white text-gray-800'
  }`;

  return (
    <article
      aria-label={isUser ? 'User message' : 'Assistant message'}
      className={`mb-3 flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`max-w-[86%] ${isUser ? 'items-end' : 'items-start'}`}>
        {taskLinks.length === 1 ? (
          <Link
            to={`/tasks/${taskLinks[0].taskId}`}
            className={`${bubbleClassName} block hover:border-cyan-300 hover:text-cyan-900 focus:outline-none focus:ring-2 focus:ring-cyan-200`}
            aria-label={`${message.content} ${taskLinks[0].label}`}
          >
            <span>{message.content}</span>
            <span className="mt-2 block text-xs font-bold text-cyan-700 underline-offset-2">
              {taskLinks[0].label}
            </span>
          </Link>
        ) : (
          <div className={bubbleClassName}>{message.content}</div>
        )}
        {taskLinks.length > 1 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {taskLinks.map((taskLink) => (
              <Link
                key={taskLink.taskId}
                to={`/tasks/${taskLink.taskId}`}
                className="rounded border border-cyan-200 bg-white px-2 py-1 text-xs font-bold text-cyan-700 hover:bg-cyan-50 focus:outline-none focus:ring-2 focus:ring-cyan-200"
              >
                {taskLink.label}
              </Link>
            ))}
          </div>
        )}
        {message.draft && (
          <DraftCard draftRecord={message.draft} onExecuted={onExecuted} onDiscarded={onDiscarded} />
        )}
      </div>
    </article>
  );
};

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AssistantPanel } from '../components/AssistantPanel';
import type { AssistantChat, AssistantChatListItem, AssistantDraftShape } from '../types';

const chatListItem: AssistantChatListItem = {
  id: 'chat-1',
  title: 'New chat',
  summary: null,
  lastMessagePreview: 'Fresh assistant chat',
  messageCount: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  lastMessageAt: new Date().toISOString(),
};

const emptyChat: AssistantChat = {
  ...chatListItem,
  messages: [],
};

const draft: AssistantDraftShape = {
  schemaVersion: 1,
  summary: 'Create the requested task',
  operations: [
    {
      id: 'create_task',
      type: 'create_task',
      label: 'Create task',
      input: {
        title: 'Write tests',
        description: 'Cover assistant drafts',
        status: 'TODO',
        priority: 'HIGH',
      },
    },
  ],
};

let actor: ReturnType<typeof userEvent.setup>;
let currentChats: AssistantChatListItem[];
let currentChat: AssistantChat;

describe('Feature: assistant panel draft workflow', () => {
  beforeEach(() => {
    actor = userEvent.setup();
    currentChats = [];
    currentChat = emptyChat;
    localStorage.setItem('token', 'auth-token');
    Element.prototype.scrollIntoView = vi.fn();
    vi.stubGlobal('fetch', vi.fn(apiResponseFor));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('opens a fresh chat, renders an editable draft, and executes the approved draft', async () => {
    const onTasksChanged = vi.fn();
    render(
      <MemoryRouter>
        <AssistantPanel onTasksChanged={onTasksChanged} />
      </MemoryRouter>,
    );

    await actor.click(screen.getByRole('button', { name: /open task assistant/i }));

    await screen.findByText(/what can i do/i);

    await actor.type(
      screen.getByPlaceholderText(/ask me to find, create, update, or delete tasks/i),
      'Create a task for assistant tests',
    );
    await actor.click(screen.getByRole('button', { name: /^send$/i }));

    const titleField = await screen.findByDisplayValue('Write tests');
    await actor.clear(titleField);
    await actor.type(titleField, 'Write integration tests');

    await actor.click(screen.getByRole('button', { name: /apply draft/i }));

    await waitFor(() => {
      expect(onTasksChanged).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText(/done\. i applied the approved changes/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /done\. i applied the approved changes\. open created task/i }))
      .toHaveAttribute('href', '/tasks/task-1');
  });
});

const apiResponseFor = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = requestUrl(input);
  const method = init?.method ?? 'GET';

  if (method === 'GET' && url.endsWith('/api/assistant/chats')) {
    return jsonResponse({ chats: currentChats });
  }

  if (method === 'POST' && url.endsWith('/api/assistant/chats')) {
    currentChats = [chatListItem];
    currentChat = emptyChat;
    return jsonResponse({ chat: chatListItem }, { status: 201 });
  }

  if (method === 'GET' && url.endsWith('/api/assistant/chats/chat-1')) {
    return jsonResponse({ chat: currentChat });
  }

  if (method === 'POST' && url.endsWith('/api/assistant/chats/chat-1/messages')) {
    currentChat = {
      ...chatListItem,
      messageCount: 2,
      messages: [
        {
          id: 'message-1',
          sequence: 1,
          role: 'USER',
          content: 'Create a task for assistant tests',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'message-2',
          sequence: 2,
          role: 'ASSISTANT',
          content: 'I drafted the task for review.',
          createdAt: new Date().toISOString(),
          draft: {
            id: 'draft-1',
            status: 'PENDING',
            originalDraft: draft,
            approvedDraft: null,
            executionResult: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            decidedAt: null,
            executedAt: null,
          },
        },
      ],
    };

    return jsonResponse({ chat: currentChat }, { status: 201 });
  }

  if (method === 'PATCH' && url.endsWith('/api/assistant/drafts/draft-1')) {
    const body = JSON.parse(String(init?.body));
    expect(body.status).toBe('EXECUTED');
    expect(body.approvedDraft.operations[0].input.title).toBe('Write integration tests');
    const executionResult = {
      ok: true,
      operations: [
        {
          operationId: 'create_task',
          type: 'create_task' as const,
          ok: true,
          entityId: 'task-1',
          taskId: 'task-1',
        },
      ],
    };

    currentChat = {
      ...currentChat,
      messages: [
        ...currentChat.messages.map((message) =>
          message.draft
            ? {
                ...message,
                draft: {
                  ...message.draft,
                  status: 'EXECUTED' as const,
                  approvedDraft: body.approvedDraft,
                  executionResult,
                  decidedAt: new Date().toISOString(),
                  executedAt: new Date().toISOString(),
                },
              }
            : message,
        ),
        {
          id: 'message-3',
          sequence: 3,
          role: 'ASSISTANT',
          content: 'Done. I applied the approved changes.',
          metadata: {
            draftId: 'draft-1',
            action: 'executed',
            executionResult,
          },
          createdAt: new Date().toISOString(),
        },
      ],
    };

    return jsonResponse({
      chat: currentChat,
      executionResult,
    });
  }

  throw new Error(`Unexpected request: ${method} ${url}`);
};

const requestUrl = (input: RequestInfo | URL) => {
  if (typeof input === 'string') {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  return input.url;
};

const jsonResponse = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AssistantWorkspace } from '../pages/AssistantWorkspace';
import { jsonResponse, requestUrl } from '../test/apiTestUtils';
import type { AssistantChat, AssistantChatListItem, AssistantDraftShape } from '../types';

const chatListItem: AssistantChatListItem = {
  id: 'chat-1',
  title: 'Create QA task',
  summary: null,
  lastMessagePreview: 'I drafted the task for review.',
  messageCount: 2,
  createdAt: new Date('2026-05-02T10:00:00.000Z').toISOString(),
  updatedAt: new Date('2026-05-02T10:00:00.000Z').toISOString(),
  lastMessageAt: new Date('2026-05-02T10:00:00.000Z').toISOString(),
};

const draft: AssistantDraftShape = {
  schemaVersion: 1,
  summary: 'Create QA task',
  operations: [
    {
      id: 'create_task',
      type: 'create_task',
      label: 'Create task',
      input: {
        title: 'Prepare QA notes',
        description: 'Write release testing notes',
        status: 'TODO',
        priority: 'HIGH',
      },
    },
  ],
};

const chat: AssistantChat = {
  ...chatListItem,
  messages: [
    {
      id: 'message-1',
      sequence: 1,
      role: 'USER',
      content: 'Create a QA task',
      createdAt: new Date('2026-05-02T10:00:00.000Z').toISOString(),
    },
    {
      id: 'message-2',
      sequence: 2,
      role: 'ASSISTANT',
      content: 'I drafted the task for review.',
      createdAt: new Date('2026-05-02T10:01:00.000Z').toISOString(),
      draft: {
        id: 'draft-1',
        status: 'PENDING',
        originalDraft: draft,
        approvedDraft: null,
        executionResult: null,
        createdAt: new Date('2026-05-02T10:01:00.000Z').toISOString(),
        updatedAt: new Date('2026-05-02T10:01:00.000Z').toISOString(),
        decidedAt: null,
        executedAt: null,
      },
    },
  ],
};

describe('Feature: assistant workspace pending draft review', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    vi.stubGlobal('fetch', vi.fn(apiResponseFor));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders chat history and the active pending draft', async () => {
    render(
      <MemoryRouter>
        <AssistantWorkspace />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Create QA task', level: 2 })).toBeInTheDocument();
    expect(screen.getByText('Pending draft')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Prepare QA notes')).toBeInTheDocument();
  });
});

const apiResponseFor = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = requestUrl(input);
  const method = init?.method ?? 'GET';

  if (method === 'GET' && url.endsWith('/api/assistant/chats')) {
    return jsonResponse({ chats: [chatListItem] });
  }

  if (method === 'GET' && url.endsWith('/api/assistant/chats/chat-1')) {
    return jsonResponse({ chat });
  }

  throw new Error(`Unexpected request: ${method} ${url}`);
};

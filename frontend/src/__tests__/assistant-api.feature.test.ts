import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAccessToken, setAccessToken } from '../auth/accessToken';
import { assistantApi } from '../services/assistantApi';
import type { AssistantChat, AssistantDraftShape, AssistantExecutionResult } from '../types';

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

const executionResult: AssistantExecutionResult = {
  ok: false,
  operations: [
    {
      operationId: 'create_task',
      type: 'create_task',
      ok: false,
      error: 'Task not found',
    },
  ],
};

const failedChat: AssistantChat = {
  id: 'chat-1',
  title: 'New chat',
  summary: null,
  lastMessagePreview: 'I could not apply the draft: Task not found',
  messageCount: 3,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  lastMessageAt: new Date().toISOString(),
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
        status: 'FAILED',
        originalDraft: draft,
        approvedDraft: draft,
        executionResult,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        decidedAt: new Date().toISOString(),
        executedAt: null,
      },
    },
    {
      id: 'message-3',
      sequence: 3,
      role: 'ASSISTANT',
      content: 'I could not apply the draft: Task not found',
      metadata: {
        draftId: 'draft-1',
        action: 'failed',
        executionResult,
      },
      createdAt: new Date().toISOString(),
    },
  ],
};

describe('Feature: assistant API failed draft execution responses', () => {
  beforeEach(() => {
    setAccessToken('auth-token');
  });

  afterEach(() => {
    clearAccessToken();
    vi.unstubAllGlobals();
  });

  it('returns the failed draft chat from a 409 execution response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      jsonResponse({
        chat: failedChat,
        executionResult,
        error: 'Task not found',
      }, { status: 409 }),
    ));

    await expect(assistantApi.executeDraft('draft-1', draft)).resolves.toEqual({
      chat: failedChat,
      executionResult,
      error: 'Task not found',
    });
  });
});

const jsonResponse = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

import assert from 'node:assert/strict';

const API_BASE_URL = process.env.ASSISTANT_TEST_BASE_URL || 'http://localhost:3000/api';
const EMAIL = process.env.ASSISTANT_TEST_EMAIL || 'john@example.com';
const PASSWORD = process.env.ASSISTANT_TEST_PASSWORD || 'password123';

interface AuthResponse {
  token: string;
}

interface ChatResponse {
  chat: {
    id: string;
    messages: Array<{
      role: string;
      content: string;
      draft?: {
        id: string;
        status: string;
        originalDraft?: unknown;
      } | null;
    }>;
  };
}

const main = async () => {
  console.log(`Running live assistant test against ${API_BASE_URL}`);

  const auth = await request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: {
      email: EMAIL,
      password: PASSWORD,
    },
  });

  const token = auth.token;
  const created = await request<ChatResponse>('/assistant/chats', {
    method: 'POST',
    token,
    body: {},
  });

  const chatId = created.chat.id;

  const shortChat = await request<ChatResponse>(`/assistant/chats/${chatId}/messages`, {
    method: 'POST',
    token,
    body: {
      message: 'How many TODO tasks do I have? Answer briefly.',
    },
  });

  const shortAssistantMessage = shortChat.chat.messages[shortChat.chat.messages.length - 1];
  assert.equal(shortAssistantMessage?.role, 'ASSISTANT');
  assert.ok(shortAssistantMessage.content.length > 0);
  console.log(`Short chat response: ${shortAssistantMessage.content}`);

  const longChat = await request<ChatResponse>(`/assistant/chats/${chatId}/messages`, {
    method: 'POST',
    token,
    body: {
      message:
        'Draft a new high priority TODO task titled "Prepare live assistant test notes" with a description that says "Capture short chat and long chat behavior before submission." Do not execute it yet.',
    },
  });

  const draftMessage = [...longChat.chat.messages].reverse().find((message) => message.draft);
  assert.equal(draftMessage?.role, 'ASSISTANT');
  assert.equal(draftMessage?.draft?.status, 'PENDING');
  assert.ok(draftMessage?.draft?.id);
  assert.ok(nonEmptyCreateTaskDescription(draftMessage.draft.originalDraft));
  const draftId = draftMessage.draft.id;
  console.log(`Long chat produced pending draft: ${draftId}`);

  const revisedChat = await request<ChatResponse>(`/assistant/chats/${chatId}/messages`, {
    method: 'POST',
    token,
    body: {
      message: 'Change the pending draft priority to LOW, and keep the same title and description.',
    },
  });

  const revisedDraftMessage = [...revisedChat.chat.messages]
    .reverse()
    .find((message) => message.draft?.status === 'PENDING');
  assert.equal(revisedDraftMessage?.role, 'ASSISTANT');
  assert.ok(revisedDraftMessage?.draft?.id);
  assert.ok(nonEmptyCreateTaskDescription(revisedDraftMessage.draft.originalDraft));
  const revisedDraftId = revisedDraftMessage.draft.id;
  assert.notEqual(revisedDraftId, draftId);
  console.log(`Pending draft was revised: ${revisedDraftId}`);

  await request<ChatResponse>(`/assistant/drafts/${revisedDraftId}`, {
    method: 'PATCH',
    token,
    body: {
      status: 'DISCARDED',
    },
  });

  await testDescriptionRecreatedAfterDiscard(token);

  console.log('Live assistant test passed. The draft was discarded, so no task was created.');
};

const testDescriptionRecreatedAfterDiscard = async (token: string) => {
  const created = await request<ChatResponse>('/assistant/chats', {
    method: 'POST',
    token,
    body: {},
  });
  const chatId = created.chat.id;

  const initialChat = await request<ChatResponse>(`/assistant/chats/${chatId}/messages`, {
    method: 'POST',
    token,
    body: {
      message: 'create a new task telling me to go to sleep',
    },
  });

  const initialDraftMessage = latestPendingDraftMessage(initialChat);
  assert.ok(initialDraftMessage?.draft?.id);

  await request<ChatResponse>(`/assistant/drafts/${initialDraftMessage.draft.id}`, {
    method: 'PATCH',
    token,
    body: {
      status: 'DISCARDED',
    },
  });

  const recreatedChat = await request<ChatResponse>(`/assistant/chats/${chatId}/messages`, {
    method: 'POST',
    token,
    body: {
      message: 'add some description to that discarded draft',
    },
  });

  const recreatedDraftMessage = latestPendingDraftMessage(recreatedChat);
  assert.equal(recreatedDraftMessage?.role, 'ASSISTANT');
  assert.ok(recreatedDraftMessage?.draft?.id);
  assert.ok(
    nonEmptyCreateTaskDescription(recreatedDraftMessage.draft.originalDraft),
    'Expected recreated create_task draft to include a non-empty description',
  );

  await request<ChatResponse>(`/assistant/drafts/${recreatedDraftMessage.draft.id}`, {
    method: 'PATCH',
    token,
    body: {
      status: 'DISCARDED',
    },
  });

  console.log('Discarded draft description recreation produced a non-empty description.');
};

const request = async <ResponseBody>(
  path: string,
  options: {
    method: 'GET' | 'POST' | 'PATCH';
    token?: string;
    body?: unknown;
  },
): Promise<ResponseBody> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method,
    headers: {
      'Content-Type': 'application/json',
      ...(options.token && { Authorization: `Bearer ${options.token}` }),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(
      `Request failed: ${options.method} ${path} -> ${response.status} ${JSON.stringify(body)}`,
    );
  }

  return body as ResponseBody;
};

const nonEmptyCreateTaskDescription = (draft: unknown) => {
  if (!isRecord(draft) || !Array.isArray(draft.operations)) {
    return false;
  }

  const createTaskOperation = draft.operations.find((operation) =>
    isRecord(operation) && operation.type === 'create_task',
  );

  if (!isRecord(createTaskOperation) || !isRecord(createTaskOperation.input)) {
    return false;
  }

  return typeof createTaskOperation.input.description === 'string'
    && createTaskOperation.input.description.trim().length > 0;
};

const latestPendingDraftMessage = (response: ChatResponse) =>
  [...response.chat.messages].reverse().find((message) => message.draft?.status === 'PENDING');

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

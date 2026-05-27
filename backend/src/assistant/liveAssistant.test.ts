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
  const draftId = draftMessage.draft.id;
  console.log(`Long chat produced pending draft: ${draftId}`);

  await request<ChatResponse>(`/assistant/drafts/${draftId}`, {
    method: 'PATCH',
    token,
    body: {
      status: 'DISCARDED',
    },
  });

  console.log('Live assistant test passed. The draft was discarded, so no task was created.');
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

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

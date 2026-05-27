import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { AuthProvider } from '../auth/AuthProvider';
import { jsonResponse, requestUrl, seededUser } from '../test/apiTestUtils';
import type { Comment, Task } from '../types';

const task: Task = {
  id: 'task-1',
  title: 'Design dashboard UI',
  description: 'Create responsive dashboard layout',
  status: 'TODO',
  priority: 'MEDIUM',
  userId: seededUser.id,
  createdAt: new Date('2026-05-01T10:00:00.000Z').toISOString(),
  updatedAt: new Date('2026-05-02T10:00:00.000Z').toISOString(),
  assignments: [],
};

const initialComment: Comment = {
  id: 'comment-1',
  taskId: task.id,
  userId: seededUser.id,
  content: 'Where are we right now with this?',
  createdAt: new Date('2026-05-02T11:00:00.000Z').toISOString(),
  updatedAt: new Date('2026-05-02T11:00:00.000Z').toISOString(),
  user: seededUser,
};

let actor: ReturnType<typeof userEvent.setup>;
let commentPostBody: unknown;

describe('Feature: task detail comment and error flows', () => {
  beforeEach(() => {
    actor = userEvent.setup();
    commentPostBody = null;
    localStorage.setItem('token', 'auth-token');
    vi.stubGlobal('fetch', vi.fn(apiResponseFor));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('loads task details and posts a new comment', async () => {
    renderAppAt('/tasks/task-1');

    await screen.findByRole('heading', { name: task.title });

    await actor.type(screen.getByLabelText(/^add comment$/i), 'Ready for QA');
    await actor.click(screen.getByRole('button', { name: /^add comment$/i }));

    await screen.findByText('Ready for QA');
    expect(commentPostBody).toEqual({
      taskId: task.id,
      content: 'Ready for QA',
    });
  });

  it('shows an inline error when task deletion fails', async () => {
    renderAppAt('/tasks/task-1?deleteFailure=1');

    await screen.findByRole('heading', { name: task.title });
    await actor.click(screen.getAllByRole('button', { name: /^delete$/i })[0]);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Delete failed');
    });
  });
});

const renderAppAt = (path: string) => {
  window.history.pushState({}, '', path);
  render(
    <AuthProvider>
      <App />
    </AuthProvider>,
  );
};

const apiResponseFor = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = requestUrl(input);
  const method = init?.method ?? 'GET';

  if (method === 'GET' && url.endsWith('/api/auth/me')) {
    return jsonResponse({ user: seededUser });
  }

  if (method === 'GET' && url.endsWith('/api/tasks/task-1')) {
    return jsonResponse(task);
  }

  if (method === 'GET' && url.endsWith('/api/comments?taskId=task-1')) {
    return jsonResponse([initialComment]);
  }

  if (method === 'POST' && url.endsWith('/api/comments')) {
    commentPostBody = JSON.parse(String(init?.body));

    return jsonResponse({
      ...initialComment,
      id: 'comment-2',
      content: (commentPostBody as { content: string }).content,
      createdAt: new Date('2026-05-02T12:00:00.000Z').toISOString(),
      updatedAt: new Date('2026-05-02T12:00:00.000Z').toISOString(),
    }, { status: 201 });
  }

  if (method === 'DELETE' && url.endsWith('/api/tasks/task-1')) {
    return jsonResponse({ error: 'Delete failed' }, { status: 500 });
  }

  throw new Error(`Unexpected request: ${method} ${url}`);
};

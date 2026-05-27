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
  assignments: [
    {
      id: 'assignment-1',
      taskId: 'task-1',
      userId: seededUser.id,
      user: seededUser,
    },
  ],
};

const secondUser = {
  id: 'user-2',
  email: 'jane@example.com',
  username: 'janedoe',
  name: 'Jane Doe',
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
let assignmentPatchBody: unknown;
let currentTask: Task;
let realtimeSockets: FakeWebSocket[];

describe('Feature: task detail comment and error flows', () => {
  beforeEach(() => {
    actor = userEvent.setup();
    commentPostBody = null;
    assignmentPatchBody = null;
    currentTask = task;
    realtimeSockets = [];
    localStorage.setItem('token', 'auth-token');
    vi.stubGlobal('WebSocket', FakeWebSocket);
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

  it('lets the task owner update assignees from the detail panel', async () => {
    renderAppAt('/tasks/task-1');

    await screen.findByRole('heading', { name: task.title });

    await actor.click(screen.getByRole('checkbox', { name: /jane doe/i }));
    await actor.click(screen.getByRole('button', { name: /^save assignments$/i }));

    await waitFor(() => {
      expect(assignmentPatchBody).toEqual({
        userIds: [seededUser.id, secondUser.id],
      });
    });
    expect(screen.getByRole('button', { name: /^save assignments$/i })).toBeDisabled();
  });

  it('reloads the task and shows live activity when another user changes it', async () => {
    renderAppAt('/tasks/task-1');

    await screen.findByRole('heading', { name: task.title });
    await waitFor(() => {
      expect(realtimeSockets).toHaveLength(1);
    });

    currentTask = {
      ...currentTask,
      title: 'Design dashboard UI refresh',
      updatedAt: new Date('2026-05-02T13:00:00.000Z').toISOString(),
    };

    realtimeSockets[0].receive({
      type: 'task.changed',
      taskId: task.id,
      action: 'updated',
      actorUserId: secondUser.id,
      occurredAt: new Date('2026-05-02T13:00:00.000Z').toISOString(),
    });

    expect(await screen.findByRole('heading', { name: 'Design dashboard UI refresh' })).toBeInTheDocument();
    expect(screen.getByText(/task fields changed by another user/i)).toBeInTheDocument();
  });

  it('hides comment entry and owner controls for an unassigned viewer', async () => {
    currentTask = {
      ...task,
      userId: secondUser.id,
      assignments: [
        {
          id: 'assignment-2',
          taskId: task.id,
          userId: secondUser.id,
          user: secondUser,
        },
      ],
    };

    renderAppAt('/tasks/task-1');

    await screen.findByRole('heading', { name: task.title });

    expect(screen.getByText(/only assigned users can add comments/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^add comment$/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^edit$/i })).not.toBeInTheDocument();
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
    return jsonResponse(currentTask);
  }

  if (method === 'GET' && url.endsWith('/api/comments?taskId=task-1')) {
    return jsonResponse([initialComment]);
  }

  if (method === 'GET' && url.endsWith('/api/users')) {
    return jsonResponse({ users: [seededUser, secondUser] });
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

  if (method === 'PATCH' && url.endsWith('/api/tasks/task-1/assignments')) {
    assignmentPatchBody = JSON.parse(String(init?.body));
    currentTask = {
      ...currentTask,
      assignments: [
        {
          id: 'assignment-1',
          taskId: task.id,
          userId: seededUser.id,
          user: seededUser,
        },
        {
          id: 'assignment-2',
          taskId: task.id,
          userId: secondUser.id,
          user: secondUser,
        },
      ],
    };

    return jsonResponse(currentTask);
  }

  if (method === 'DELETE' && url.endsWith('/api/tasks/task-1')) {
    return jsonResponse({ error: 'Delete failed' }, { status: 500 });
  }

  throw new Error(`Unexpected request: ${method} ${url}`);
};

type FakeWebSocketEvent = {
  code?: number;
  data?: string;
};

type FakeWebSocketListener = (event: FakeWebSocketEvent) => void;

class FakeWebSocket {
  static readonly OPEN = 1;
  static readonly CLOSED = 3;

  readonly sentMessages: string[] = [];
  readonly url: string;
  readyState = FakeWebSocket.OPEN;
  private readonly listeners: Record<string, FakeWebSocketListener[]> = {};

  constructor(url: string) {
    this.url = url;
    realtimeSockets.push(this);
    window.setTimeout(() => this.emit('open', {}), 0);
  }

  addEventListener(type: string, listener: FakeWebSocketListener) {
    this.listeners[type] = [...(this.listeners[type] ?? []), listener];
  }

  send(message: string) {
    this.sentMessages.push(message);
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED;
    this.emit('close', { code: 1000 });
  }

  receive(message: unknown) {
    this.emit('message', { data: JSON.stringify(message) });
  }

  private emit(type: string, event: FakeWebSocketEvent) {
    for (const listener of this.listeners[type] ?? []) {
      listener(event);
    }
  }
}

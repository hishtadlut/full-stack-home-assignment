import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { AuthProvider } from '../auth/AuthProvider';
import { jsonResponse, requestUrl, seededUser } from '../test/apiTestUtils';
import type { Task } from '../types';

const validToken = 'auth-token';

const baseTasks: Task[] = [
  {
    id: 'task-1',
    title: 'Implement user authentication',
    description: 'Add login and registration functionality',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
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
  },
  {
    id: 'task-owned-only',
    title: 'Owned task without assignment',
    description: 'The current user owns this task but is not assigned.',
    status: 'TODO',
    priority: 'LOW',
    userId: seededUser.id,
    createdAt: new Date('2026-05-01T09:00:00.000Z').toISOString(),
    updatedAt: new Date('2026-05-02T09:00:00.000Z').toISOString(),
    assignments: [],
  },
];

let actor: ReturnType<typeof userEvent.setup>;
let taskRequestUrls: string[];
let tasks: Task[];
let realtimeSockets: FakeWebSocket[];

describe('Feature: dashboard filters are reflected in the URL and task requests', () => {
  beforeEach(() => {
    actor = userEvent.setup();
    taskRequestUrls = [];
    tasks = [...baseTasks];
    realtimeSockets = [];
    vi.stubGlobal('WebSocket', FakeWebSocket);
    vi.stubGlobal('fetch', vi.fn(apiResponseFor));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('updates search, status, and priority without leaving the dashboard', async () => {
    renderAppAt('/dashboard');

    await screen.findByRole('heading', { name: /^dashboard$/i });

    await actor.selectOptions(screen.getByLabelText(/^status$/i), 'IN_PROGRESS');
    await actor.selectOptions(screen.getByLabelText(/^priority$/i), 'HIGH');
    await actor.type(screen.getByLabelText(/^search$/i), 'auth');

    await waitFor(() => {
      expect(window.location.pathname).toBe('/dashboard');
      expect(window.location.search).toContain('status=IN_PROGRESS');
      expect(window.location.search).toContain('priority=HIGH');
      expect(window.location.search).toContain('search=auth');
    });

    await waitFor(() => {
      expect(taskRequestUrls.some((url) =>
        url.includes('/api/tasks')
        && url.includes('status=IN_PROGRESS')
        && url.includes('priority=HIGH')
        && url.includes('search=auth'),
      )).toBe(true);
    });
  });

  it('does not show tasks unless the current user is assigned', async () => {
    renderAppAt('/dashboard');

    await screen.findByRole('heading', { name: /^dashboard$/i });

    expect(await screen.findByText('Implement user authentication')).toBeInTheDocument();
    expect(screen.queryByText('Owned task without assignment')).not.toBeInTheDocument();
    expect(screen.getByText('1 result')).toBeInTheDocument();
  });

  it('saves, reapplies, and deletes a dashboard filter preset', async () => {
    renderAppAt('/dashboard?status=IN_PROGRESS&priority=HIGH&search=auth');

    await screen.findByRole('heading', { name: /^dashboard$/i });

    await actor.click(screen.getByRole('button', { name: /^save current view$/i }));

    expect(await screen.findByRole('button', { name: /apply saved view/i }))
      .toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByText(/search: "auth" \+ status: in progress \+ priority: high/i).length)
      .toBeGreaterThan(0);

    await actor.click(screen.getByRole('button', { name: /^clear$/i }));

    await waitFor(() => {
      expect(window.location.search).not.toContain('status=IN_PROGRESS');
      expect(window.location.search).not.toContain('priority=HIGH');
      expect(window.location.search).not.toContain('search=auth');
    });

    await actor.click(screen.getByRole('button', { name: /apply saved view/i }));

    await waitFor(() => {
      expect(window.location.search).toContain('status=IN_PROGRESS');
      expect(window.location.search).toContain('priority=HIGH');
      expect(window.location.search).toContain('search=auth');
    });

    await waitFor(() => {
      expect(taskRequestUrls.some((url) =>
        url.includes('/api/tasks')
        && url.includes('status=IN_PROGRESS')
        && url.includes('priority=HIGH')
        && url.includes('search=auth'),
      )).toBe(true);
    });

    await actor.click(screen.getByRole('button', { name: /delete saved view/i }));

    expect(screen.queryByRole('button', { name: /apply saved view/i })).not.toBeInTheDocument();
  });

  it('removes a task from the current view when an update no longer matches active filters', async () => {
    tasks = [
      {
        ...baseTasks[0],
        title: 'Filtered task',
        status: 'DONE',
      },
    ];

    renderAppAt('/dashboard?status=DONE&view=table');

    const taskRow = await screen.findByRole('row', { name: /filtered task/i });
    await actor.selectOptions(within(taskRow).getByRole('combobox'), 'TODO');

    await waitFor(() => {
      expect(screen.queryByText('Filtered task')).not.toBeInTheDocument();
      expect(screen.getByText('No tasks match this view')).toBeInTheDocument();
    });
  });

  it('lets assigned non-owners edit task status from the dashboard', async () => {
    tasks = [
      {
        ...baseTasks[0],
        userId: 'task-owner-2',
      },
    ];

    renderAppAt('/dashboard?view=table');

    const taskRow = await screen.findByRole('row', { name: /implement user authentication/i });
    expect(within(taskRow).queryByRole('button', { name: /^delete$/i })).not.toBeInTheDocument();

    await actor.selectOptions(within(taskRow).getByRole('combobox'), 'TODO');

    await waitFor(() => {
      expect(tasks[0].status).toBe('TODO');
    });
  });

  it('does not insert a newly created task into an active filter it does not match', async () => {
    tasks = [];

    renderAppAt('/dashboard?status=DONE');

    await screen.findByRole('heading', { name: /^dashboard$/i });

    await actor.click(screen.getByRole('button', { name: /new task/i }));
    await actor.type(screen.getByLabelText(/^title$/i), 'Todo created under done filter');
    await actor.click(screen.getByRole('button', { name: /create task/i }));

    await waitFor(() => {
      expect(screen.queryByText('Todo created under done filter')).not.toBeInTheDocument();
      expect(screen.getByText('No tasks match this view')).toBeInTheDocument();
    });
  });

  it('refreshes dashboard tasks when a websocket update arrives', async () => {
    renderAppAt('/dashboard');

    await screen.findByText('Implement user authentication');
    await waitFor(() => {
      expect(realtimeSockets.length).toBeGreaterThan(0);
      expect(latestRealtimeSocket().url).not.toContain('token=');
      expect(latestRealtimeSocket().protocols).toEqual(['task-events', `auth.${validToken}`]);
      expect(latestRealtimeSocket().sentMessages).toContain(JSON.stringify({ type: 'subscribe_task_list' }));
      expect(latestRealtimeSocket().sentMessages).toContain(JSON.stringify({ type: 'subscribe', taskId: 'task-1' }));
    });

    tasks = [
      {
        ...baseTasks[0],
        title: 'Implement websocket refresh',
        updatedAt: new Date('2026-05-03T12:00:00.000Z').toISOString(),
      },
    ];

    latestRealtimeSocket().receive({
      type: 'task.changed',
      taskId: 'task-1',
      action: 'updated',
      actorUserId: 'user-2',
      occurredAt: new Date('2026-05-03T12:00:00.000Z').toISOString(),
    });

    expect(await screen.findByText('Implement websocket refresh')).toBeInTheDocument();
  });

  it('refreshes dashboard tasks when the user is newly assigned to a task', async () => {
    tasks = [];

    renderAppAt('/dashboard');

    await screen.findByText('No tasks match this view');
    await waitFor(() => {
      expect(realtimeSockets.length).toBeGreaterThan(0);
      expect(latestRealtimeSocket().sentMessages).toContain(JSON.stringify({ type: 'subscribe_task_list' }));
    });

    tasks = [
      {
        ...baseTasks[0],
        id: 'newly-assigned-task',
        title: 'Review newly assigned task',
        updatedAt: new Date('2026-05-03T13:00:00.000Z').toISOString(),
      },
    ];

    latestRealtimeSocket().receive({
      type: 'task.list.changed',
      actorUserId: 'user-2',
      occurredAt: new Date('2026-05-03T13:00:00.000Z').toISOString(),
    });

    expect(await screen.findByText('Review newly assigned task')).toBeInTheDocument();
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

const latestRealtimeSocket = () => {
  const socket = realtimeSockets.at(-1);

  if (!socket) {
    throw new Error('Expected a realtime socket');
  }

  return socket;
};

const apiResponseFor = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = requestUrl(input);
  const method = init?.method ?? 'GET';

  if (method === 'GET' && url.endsWith('/api/auth/me')) {
    return jsonResponse({ user: seededUser });
  }

  if (method === 'POST' && url.endsWith('/api/auth/refresh')) {
    return jsonResponse({ token: validToken, user: seededUser });
  }

  if (method === 'GET' && url.includes('/api/tasks')) {
    taskRequestUrls.push(url);
    return jsonResponse(tasks);
  }

  if (method === 'POST' && url.endsWith('/api/tasks')) {
    const body = JSON.parse(String(init?.body ?? '{}')) as Partial<Task>;
    const createdTask: Task = {
      id: 'created-task',
      title: body.title ?? 'Created task',
      description: body.description ?? null,
      status: body.status ?? 'TODO',
      priority: body.priority ?? 'MEDIUM',
      userId: seededUser.id,
      createdAt: new Date('2026-05-03T10:00:00.000Z').toISOString(),
      updatedAt: new Date('2026-05-03T10:00:00.000Z').toISOString(),
    };

    tasks = [createdTask, ...tasks];
    return jsonResponse(createdTask);
  }

  if (method === 'PATCH' && url.includes('/api/tasks/task-1')) {
    const body = JSON.parse(String(init?.body ?? '{}')) as Partial<Task>;
    const updatedTask = {
      ...tasks[0],
      ...body,
      updatedAt: new Date('2026-05-03T10:00:00.000Z').toISOString(),
    };

    tasks = tasks.map((task) => (task.id === updatedTask.id ? updatedTask : task));
    return jsonResponse(updatedTask);
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
  readonly protocols: string[];
  readyState = FakeWebSocket.OPEN;
  private readonly listeners: Record<string, FakeWebSocketListener[]> = {};

  constructor(url: string, protocols?: string | string[]) {
    this.url = url;
    this.protocols = Array.isArray(protocols) ? protocols : protocols ? [protocols] : [];
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

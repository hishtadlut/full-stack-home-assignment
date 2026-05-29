import { once } from 'events';
import { createServer, type Server } from 'http';
import type { AddressInfo } from 'net';
import WebSocket, { WebSocketServer } from 'ws';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  attachTaskEventServer,
  publishTaskChanged,
  publishTaskListChanged,
  type TaskChangedAction,
} from './taskEvents';

const mocks = vi.hoisted(() => ({
  findVisibleTaskIdForUser: vi.fn(),
  prisma: {},
  verifyAuthToken: vi.fn(),
}));

vi.mock('../db/prisma', () => ({ prisma: mocks.prisma }));
vi.mock('../db/taskQueries', () => ({ findVisibleTaskIdForUser: mocks.findVisibleTaskIdForUser }));
vi.mock('../utils/jwt', () => ({ verifyAuthToken: mocks.verifyAuthToken }));

const taskActions: TaskChangedAction[] = [
  'updated',
  'assignments_updated',
  'deleted',
  'comment_created',
  'comment_deleted',
];

let server: Server | undefined;
let wss: WebSocketServer | undefined;
let sockets: WebSocket[];

beforeEach(() => {
  vi.clearAllMocks();
  sockets = [];
});

afterEach(async () => {
  await Promise.all(sockets.map(closeSocket));
  await closeWebSocketServer();
  await closeServer();
});

describe('task realtime events', () => {
  it('rejects sockets with no token', async () => {
    await startTaskEventServer();

    const close = await waitForClose(createSocket());

    expect(close.code).toBe(1008);
    expect(close.reason).toBe('Authentication required');
    expect(mocks.verifyAuthToken).not.toHaveBeenCalled();
  });

  it('rejects sockets with invalid tokens', async () => {
    await startTaskEventServer();
    mocks.verifyAuthToken.mockImplementation(() => {
      throw new Error('invalid token');
    });

    const close = await waitForClose(createSocket('bad-token'));

    expect(close.code).toBe(1008);
    expect(close.reason).toBe('Authentication required');
    expect(mocks.verifyAuthToken).toHaveBeenCalledWith('bad-token');
  });

  it('does not accept tokens from the websocket URL query string', async () => {
    await startTaskEventServer();

    const close = await waitForClose(createSocketWithQueryToken('valid-token'));

    expect(close.code).toBe(1008);
    expect(close.reason).toBe('Authentication required');
    expect(mocks.verifyAuthToken).not.toHaveBeenCalled();
  });

  it.each(taskActions)('subscribes visible task viewers and broadcasts %s events', async (action) => {
    await startTaskEventServer();
    mocks.verifyAuthToken.mockReturnValue({ userId: 'user-1' });
    mocks.findVisibleTaskIdForUser.mockResolvedValue({ id: 'task-1' });

    const socket = await openSocket('valid-token');
    subscribe(socket, 'task-1');

    await expectJson(socket, { type: 'subscribed', taskId: 'task-1' });
    publishTaskChanged({ taskId: 'task-1', action, actorUserId: 'user-2' });

    const event = await waitForJson(socket);

    expect(event).toMatchObject({
      type: 'task.changed',
      taskId: 'task-1',
      action,
      actorUserId: 'user-2',
    });
    expect(event).toHaveProperty('occurredAt', expect.any(String));
    expect(mocks.findVisibleTaskIdForUser).toHaveBeenCalledWith(mocks.prisma, 'user-1', 'task-1');
  });

  it('broadcasts only to open clients subscribed to the changed task', async () => {
    await startTaskEventServer();
    mocks.verifyAuthToken.mockImplementation((token: string) => ({ userId: token }));
    mocks.findVisibleTaskIdForUser.mockImplementation(
      async (_prisma: unknown, _userId: string, taskId: string) => ({ id: taskId }),
    );

    const firstTaskViewer = await openSocket('user-1');
    const secondTaskViewer = await openSocket('user-2');
    const otherTaskViewer = await openSocket('user-3');
    const unsubscribedViewer = await openSocket('user-4');

    subscribe(firstTaskViewer, 'task-1');
    await expectJson(firstTaskViewer, { type: 'subscribed', taskId: 'task-1' });

    subscribe(secondTaskViewer, 'task-1');
    await expectJson(secondTaskViewer, { type: 'subscribed', taskId: 'task-1' });

    subscribe(otherTaskViewer, 'task-2');
    await expectJson(otherTaskViewer, { type: 'subscribed', taskId: 'task-2' });

    await closeSocket(secondTaskViewer);
    publishTaskChanged({ taskId: 'task-1', action: 'updated', actorUserId: 'user-5' });

    await expectJson(firstTaskViewer, {
      type: 'task.changed',
      taskId: 'task-1',
      action: 'updated',
      actorUserId: 'user-5',
    });
    await expectNoMessage(otherTaskViewer);
    await expectNoMessage(unsubscribedViewer);
  });

  it('broadcasts task list changes only to affected dashboard subscribers', async () => {
    await startTaskEventServer();
    mocks.verifyAuthToken.mockImplementation((token: string) => ({ userId: token }));

    const affectedDashboard = await openSocket('user-1');
    const unaffectedDashboard = await openSocket('user-2');
    const unsubscribedAffectedUser = await openSocket('user-3');

    subscribeTaskList(affectedDashboard);
    await expectJson(affectedDashboard, { type: 'subscribed_task_list' });

    subscribeTaskList(unaffectedDashboard);
    await expectJson(unaffectedDashboard, { type: 'subscribed_task_list' });

    publishTaskListChanged({ userIds: ['user-1', 'user-3'], actorUserId: 'user-4' });

    await expectJson(affectedDashboard, {
      type: 'task.list.changed',
      actorUserId: 'user-4',
    });
    await expectNoMessage(unaffectedDashboard);
    await expectNoMessage(unsubscribedAffectedUser);
  });

  it('drops subscribed clients that can no longer view the task before broadcasting', async () => {
    await startTaskEventServer();
    mocks.verifyAuthToken.mockReturnValue({ userId: 'user-1' });
    mocks.findVisibleTaskIdForUser
      .mockResolvedValueOnce({ id: 'task-1' })
      .mockResolvedValueOnce(null);

    const socket = await openSocket('valid-token');
    subscribe(socket, 'task-1');
    await expectJson(socket, { type: 'subscribed', taskId: 'task-1' });

    const noMessage = expectNoMessage(socket);
    publishTaskChanged({ taskId: 'task-1', action: 'assignments_updated', actorUserId: 'user-2' });

    await waitFor(
      () => mocks.findVisibleTaskIdForUser.mock.calls.length === 2,
      'Timed out waiting for realtime visibility check',
    );
    await noMessage;
  });

  it('returns subscription errors for tasks the user cannot view', async () => {
    await startTaskEventServer();
    mocks.verifyAuthToken.mockReturnValue({ userId: 'user-1' });
    mocks.findVisibleTaskIdForUser.mockResolvedValue(null);

    const socket = await openSocket('valid-token');
    subscribe(socket, 'task-1');

    await expectJson(socket, {
      type: 'subscription.error',
      taskId: 'task-1',
      message: 'Task not found',
    });
  });

  it('rejects malformed client messages', async () => {
    await startTaskEventServer();
    mocks.verifyAuthToken.mockReturnValue({ userId: 'user-1' });

    const socket = await openSocket('valid-token');

    for (const message of [
      'not-json',
      JSON.stringify({}),
      JSON.stringify({ type: 'subscribe' }),
      JSON.stringify({ type: 'subscribe', taskId: '' }),
      JSON.stringify({ type: 'subscribe', taskId: '   ' }),
      JSON.stringify({ type: 'subscribe', taskId: 123 }),
      JSON.stringify({ type: 'unknown', taskId: 'task-1' }),
    ]) {
      socket.send(message);
      await expectJson(socket, { type: 'error', message: 'Invalid realtime message' });
    }

    expect(mocks.findVisibleTaskIdForUser).not.toHaveBeenCalled();
  });

  it('handles unsubscribe requests without touching task visibility', async () => {
    await startTaskEventServer();
    mocks.verifyAuthToken.mockReturnValue({ userId: 'user-1' });
    mocks.findVisibleTaskIdForUser.mockResolvedValue({ id: 'task-1' });

    const socket = await openSocket('valid-token');

    socket.send(JSON.stringify({ type: 'unsubscribe', taskId: 'task-1' }));
    await waitForServerMessageHandling();
    expect(mocks.findVisibleTaskIdForUser).not.toHaveBeenCalled();

    subscribe(socket, 'task-1');
    await expectJson(socket, { type: 'subscribed', taskId: 'task-1' });

    socket.send(JSON.stringify({ type: 'unsubscribe', taskId: 'task-1' }));
    await waitForServerMessageHandling();
    publishTaskChanged({ taskId: 'task-1', action: 'deleted', actorUserId: 'user-2' });

    await expectNoMessage(socket);
  });

  it('keeps responsive clients alive during heartbeat checks', async () => {
    await startTaskEventServer({ heartbeatIntervalMs: 20, refHeartbeat: true });
    mocks.verifyAuthToken.mockReturnValue({ userId: 'user-1' });
    mocks.findVisibleTaskIdForUser.mockResolvedValue({ id: 'task-1' });

    const socket = await openSocket('valid-token');
    subscribe(socket, 'task-1');
    await expectJson(socket, { type: 'subscribed', taskId: 'task-1' });
    const serverSocket = currentServerSocket();
    const pingSpy = vi.spyOn(serverSocket, 'ping');

    await waitFor(() => pingSpy.mock.calls.length > 0, 'Timed out waiting for heartbeat ping');
    await wait(50);
    publishTaskChanged({ taskId: 'task-1', action: 'updated', actorUserId: 'user-2' });

    await expectJson(socket, {
      type: 'task.changed',
      taskId: 'task-1',
      action: 'updated',
      actorUserId: 'user-2',
    });
  });

  it('terminates unresponsive clients during heartbeat checks', async () => {
    await startTaskEventServer({ heartbeatIntervalMs: 20, refHeartbeat: true });
    mocks.verifyAuthToken.mockReturnValue({ userId: 'user-1' });
    mocks.findVisibleTaskIdForUser.mockResolvedValue({ id: 'task-1' });

    const socket = await openSocket('valid-token', { autoPong: false });
    subscribe(socket, 'task-1');
    await expectJson(socket, { type: 'subscribed', taskId: 'task-1' });
    const serverSocket = currentServerSocket();
    const terminateSpy = vi.spyOn(serverSocket, 'terminate');

    const close = await waitForClose(socket);

    expect(close.code).toBe(1006);
    expect(terminateSpy).toHaveBeenCalled();
    expect(() => publishTaskChanged({ taskId: 'task-1', action: 'updated', actorUserId: 'user-2' })).not.toThrow();
  });

  it('clears the heartbeat timer when the websocket server closes', async () => {
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

    await startTaskEventServer({ heartbeatIntervalMs: 20, refHeartbeat: true });
    await closeWebSocketServer();

    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });
});

const startTaskEventServer = async (options?: Parameters<typeof attachTaskEventServer>[1]) => {
  server = createServer();
  wss = attachTaskEventServer(server, options);

  await new Promise<void>((resolve) => {
    server?.listen(0, '127.0.0.1', resolve);
  });
};

const createSocket = (token?: string, options?: WebSocket.ClientOptions) => {
  const url = new URL(socketBaseUrl());
  const protocols = token ? ['task-events', `auth.${token}`] : ['task-events'];

  const socket = new WebSocket(url.toString(), protocols, options);
  sockets.push(socket);
  return socket;
};

const createSocketWithQueryToken = (token: string) => {
  const url = new URL(socketBaseUrl());
  url.searchParams.set('token', token);

  const socket = new WebSocket(url.toString(), ['task-events']);
  sockets.push(socket);
  return socket;
};

const openSocket = async (token: string, options?: WebSocket.ClientOptions) => {
  const socket = createSocket(token, options);
  await withTimeout(once(socket, 'open'), 'Timed out opening WebSocket');
  return socket;
};

const subscribe = (socket: WebSocket, taskId: string) => {
  socket.send(JSON.stringify({ type: 'subscribe', taskId }));
};

const subscribeTaskList = (socket: WebSocket) => {
  socket.send(JSON.stringify({ type: 'subscribe_task_list' }));
};

const socketBaseUrl = () => {
  const address = server?.address() as AddressInfo | null;

  if (!address) {
    throw new Error('Test server is not listening');
  }

  return `ws://127.0.0.1:${address.port}/ws/tasks`;
};

const currentServerSocket = () => {
  const [socket] = [...(wss?.clients ?? [])];

  if (!socket) {
    throw new Error('Expected a connected server websocket');
  }

  return socket;
};

const waitForJson = async (socket: WebSocket) => {
  const [data] = await withTimeout(once(socket, 'message'), 'Timed out waiting for WebSocket message');
  return JSON.parse(data.toString()) as Record<string, unknown>;
};

const expectJson = async (socket: WebSocket, expected: Record<string, unknown>) => {
  await expect(waitForJson(socket)).resolves.toMatchObject(expected);
};

const expectNoMessage = (socket: WebSocket) =>
  new Promise<void>((resolve, reject) => {
    const onMessage = (data: WebSocket.RawData) => {
      cleanup();
      reject(new Error(`Unexpected WebSocket message: ${data.toString()}`));
    };

    const timeout = setTimeout(() => {
      cleanup();
      resolve();
    }, 50);

    const cleanup = () => {
      clearTimeout(timeout);
      socket.off('message', onMessage);
    };

    socket.on('message', onMessage);
  });

const waitForClose = async (socket: WebSocket) => {
  const [code, reason] = await withTimeout(once(socket, 'close'), 'Timed out waiting for WebSocket close');
  return { code, reason: reason.toString() };
};

const waitForServerMessageHandling = () => wait(10);

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const waitFor = async (condition: () => boolean, message: string) => {
  const start = Date.now();

  while (!condition()) {
    if (Date.now() - start > 1_000) {
      throw new Error(message);
    }

    await wait(10);
  }
};

const closeSocket = async (socket: WebSocket) => {
  if (socket.readyState === WebSocket.CLOSED) {
    return;
  }

  const closed = once(socket, 'close');
  socket.close();
  await withTimeout(closed, 'Timed out closing WebSocket');
};

const closeWebSocketServer = async () => {
  if (!wss) {
    return;
  }

  const serverToClose = wss;
  wss = undefined;
  await new Promise<void>((resolve) => serverToClose.close(() => resolve()));
};

const closeServer = async () => {
  if (!server) {
    return;
  }

  const serverToClose = server;
  server = undefined;
  await new Promise<void>((resolve, reject) => {
    serverToClose.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
};

const withTimeout = async <T>(promise: Promise<T>, message: string) => {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), 1_000);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
};

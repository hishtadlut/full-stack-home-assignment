import type { IncomingMessage, Server as HttpServer } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { prisma } from '../db/prisma';
import { findVisibleTaskIdForUser } from '../db/taskQueries';
import { verifyAuthToken } from '../utils/jwt';

export type TaskChangedAction =
  | 'updated'
  | 'assignments_updated'
  | 'deleted'
  | 'comment_created'
  | 'comment_deleted';

export interface TaskChangedEvent {
  type: 'task.changed';
  taskId: string;
  action: TaskChangedAction;
  actorUserId: string;
  occurredAt: string;
}

interface TaskClient {
  userId: string;
  taskIds: Set<string>;
  socket: WebSocket;
  isAlive: boolean;
}

interface AttachTaskEventServerOptions {
  heartbeatIntervalMs?: number;
  refHeartbeat?: boolean;
}

const clients = new Set<TaskClient>();
const TASK_HEARTBEAT_INTERVAL_MS = 30_000;

export const attachTaskEventServer = (
  server: HttpServer,
  { heartbeatIntervalMs = TASK_HEARTBEAT_INTERVAL_MS, refHeartbeat = false }: AttachTaskEventServerOptions = {},
) => {
  const wss = new WebSocketServer({ server, path: '/ws/tasks' });
  const heartbeatTimer = setInterval(() => {
    for (const client of clients) {
      if (client.socket.readyState !== WebSocket.OPEN) {
        clients.delete(client);
        continue;
      }

      if (!client.isAlive) {
        clients.delete(client);
        client.socket.terminate();
        continue;
      }

      client.isAlive = false;
      client.socket.ping();
    }
  }, heartbeatIntervalMs);

  if (!refHeartbeat) {
    heartbeatTimer.unref();
  }

  wss.on('connection', (socket, request) => {
    const userId = authenticateSocket(request);

    if (!userId) {
      socket.close(1008, 'Authentication required');
      return;
    }

    const client: TaskClient = {
      userId,
      socket,
      taskIds: new Set(),
      isAlive: true,
    };

    clients.add(client);

    socket.on('pong', () => {
      client.isAlive = true;
    });

    socket.on('message', (message) => {
      void handleClientMessage(client, message.toString());
    });

    socket.on('close', () => {
      clients.delete(client);
    });
  });

  wss.on('close', () => {
    clearInterval(heartbeatTimer);
  });

  return wss;
};

export const publishTaskChanged = (event: Omit<TaskChangedEvent, 'type' | 'occurredAt'>) => {
  const message = JSON.stringify({
    type: 'task.changed',
    occurredAt: new Date().toISOString(),
    ...event,
  } satisfies TaskChangedEvent);

  for (const client of clients) {
    if (client.taskIds.has(event.taskId) && client.socket.readyState === WebSocket.OPEN) {
      client.socket.send(message);
    }
  }
};

const authenticateSocket = (request: IncomingMessage) => {
  const token = new URL(request.url ?? '', 'http://localhost').searchParams.get('token');

  if (!token) {
    return null;
  }

  try {
    return verifyAuthToken(token).userId;
  } catch {
    return null;
  }
};

const handleClientMessage = async (client: TaskClient, rawMessage: string) => {
  const message = parseClientMessage(rawMessage);

  if (!message) {
    sendJson(client.socket, { type: 'error', message: 'Invalid realtime message' });
    return;
  }

  if (message.type === 'unsubscribe') {
    client.taskIds.delete(message.taskId);
    return;
  }

  const task = await findVisibleTaskIdForUser(prisma, client.userId, message.taskId);

  if (!task) {
    sendJson(client.socket, {
      type: 'subscription.error',
      taskId: message.taskId,
      message: 'Task not found',
    });
    return;
  }

  client.taskIds.add(message.taskId);
  sendJson(client.socket, { type: 'subscribed', taskId: message.taskId });
};

type ClientMessage =
  | { type: 'subscribe'; taskId: string }
  | { type: 'unsubscribe'; taskId: string };

const parseClientMessage = (rawMessage: string): ClientMessage | null => {
  try {
    const message = JSON.parse(rawMessage) as Partial<ClientMessage>;

    if (
      (message.type !== 'subscribe' && message.type !== 'unsubscribe') ||
      typeof message.taskId !== 'string' ||
      message.taskId.trim().length === 0
    ) {
      return null;
    }

    return {
      type: message.type,
      taskId: message.taskId,
    };
  } catch {
    return null;
  }
};

const sendJson = (socket: WebSocket, message: unknown) => {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
};

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

export interface TaskListChangedEvent {
  type: 'task.list.changed';
  actorUserId: string;
  occurredAt: string;
}

interface TaskClient {
  userId: string;
  taskIds: Set<string>;
  taskListSubscribed: boolean;
  socket: WebSocket;
  isAlive: boolean;
}

interface AttachTaskEventServerOptions {
  heartbeatIntervalMs?: number;
  refHeartbeat?: boolean;
}

const clients = new Set<TaskClient>();
const TASK_HEARTBEAT_INTERVAL_MS = 30_000;
const REALTIME_PROTOCOL = 'task-events';
const AUTH_PROTOCOL_PREFIX = 'auth.';

export const attachTaskEventServer = (
  server: HttpServer,
  { heartbeatIntervalMs = TASK_HEARTBEAT_INTERVAL_MS, refHeartbeat = false }: AttachTaskEventServerOptions = {},
) => {
  const wss = new WebSocketServer({
    server,
    path: '/ws/tasks',
    handleProtocols(protocols) {
      return protocols.has(REALTIME_PROTOCOL) ? REALTIME_PROTOCOL : false;
    },
  });
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
      taskListSubscribed: false,
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

  void publishTaskChangedToAuthorizedClients(event.taskId, message).catch((error) => {
    console.error('Error publishing task realtime event:', error);
  });
};

export const publishTaskListChanged = ({
  userIds,
  actorUserId,
}: Omit<TaskListChangedEvent, 'type' | 'occurredAt'> & { userIds: string[] }) => {
  const recipientUserIds = new Set(userIds.filter((userId) => userId.trim().length > 0));

  if (recipientUserIds.size === 0) {
    return;
  }

  const message = JSON.stringify({
    type: 'task.list.changed',
    actorUserId,
    occurredAt: new Date().toISOString(),
  } satisfies TaskListChangedEvent);

  for (const client of clients) {
    if (
      client.taskListSubscribed &&
      recipientUserIds.has(client.userId) &&
      client.socket.readyState === WebSocket.OPEN
    ) {
      client.socket.send(message);
    }
  }
};

const publishTaskChangedToAuthorizedClients = async (taskId: string, message: string) => {
  for (const client of clients) {
    if (!client.taskIds.has(taskId) || client.socket.readyState !== WebSocket.OPEN) {
      continue;
    }

    const task = await findVisibleTaskIdForUser(prisma, client.userId, taskId);

    if (!task) {
      client.taskIds.delete(taskId);
      continue;
    }

    if (client.socket.readyState === WebSocket.OPEN) {
      client.socket.send(message);
    }
  }
};

const authenticateSocket = (request: IncomingMessage) => {
  const token = tokenFromProtocols(request.headers['sec-websocket-protocol']);

  if (!token) {
    return null;
  }

  try {
    return verifyAuthToken(token).userId;
  } catch {
    return null;
  }
};

const tokenFromProtocols = (protocolHeader: string | string[] | undefined) => {
  const protocols = Array.isArray(protocolHeader) ? protocolHeader : [protocolHeader ?? ''];
  const authProtocol = protocols
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .find((value) => value.startsWith(AUTH_PROTOCOL_PREFIX));

  return authProtocol?.slice(AUTH_PROTOCOL_PREFIX.length) || null;
};

const handleClientMessage = async (client: TaskClient, rawMessage: string) => {
  const message = parseClientMessage(rawMessage);

  if (!message) {
    sendJson(client.socket, { type: 'error', message: 'Invalid realtime message' });
    return;
  }

  if (message.type === 'subscribe_task_list') {
    client.taskListSubscribed = true;
    sendJson(client.socket, { type: 'subscribed_task_list' });
    return;
  }

  if (message.type === 'unsubscribe_task_list') {
    client.taskListSubscribed = false;
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
  | { type: 'unsubscribe'; taskId: string }
  | { type: 'subscribe_task_list' }
  | { type: 'unsubscribe_task_list' };

const parseClientMessage = (rawMessage: string): ClientMessage | null => {
  try {
    const message = JSON.parse(rawMessage) as { type?: unknown; taskId?: unknown };

    if (message.type === 'subscribe_task_list' || message.type === 'unsubscribe_task_list') {
      return {
        type: message.type,
      };
    }

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

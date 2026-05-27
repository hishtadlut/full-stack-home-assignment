import { useEffect, useRef, useState } from 'react';

const ACTION_MESSAGES = {
  updated: 'Task fields changed by another user',
  assignments_updated: 'Assignments changed by another user',
  deleted: 'Task deleted by another user',
  comment_created: 'New comment added by another user',
  comment_deleted: 'Comment deleted by another user',
} as const;

type TaskChangedAction = keyof typeof ACTION_MESSAGES;

interface TaskChangedEvent {
  type: 'task.changed';
  taskId: string;
  action: TaskChangedAction;
  actorUserId: string;
  occurredAt: string;
}

export interface TaskRealtimeNotification {
  id: string;
  message: string;
  occurredAt: string;
}

interface UseTaskRealtimeOptions {
  taskId?: string;
  taskIds?: string[];
  currentUserId: string | null;
  onExternalTaskChanged: () => void;
}

const API_URL = import.meta.env.VITE_API_URL || '/api';
const RECONNECT_DELAY_MS = 2000;
const MAX_NOTIFICATIONS = 5;

export const useTaskRealtime = ({
  taskId,
  taskIds,
  currentUserId,
  onExternalTaskChanged,
}: UseTaskRealtimeOptions) => {
  const [notifications, setNotifications] = useState<TaskRealtimeNotification[]>([]);
  const optionsRef = useRef({ currentUserId, onExternalTaskChanged });
  const subscribedTaskIds = uniqueTaskIds(taskIds ?? (taskId ? [taskId] : []));
  const subscriptionKey = subscribedTaskIds.join('|');

  useEffect(() => {
    optionsRef.current = { currentUserId, onExternalTaskChanged };
  }, [currentUserId, onExternalTaskChanged]);

  useEffect(() => {
    setNotifications([]);
  }, [subscriptionKey]);

  useEffect(() => {
    const token = localStorage.getItem('token');

    if (subscribedTaskIds.length === 0 || !token || typeof window.WebSocket === 'undefined') {
      return undefined;
    }

    let closed = false;
    let reconnectTimer: number | undefined;
    let socket: WebSocket | null = null;
    const subscribedTaskIdSet = new Set(subscribedTaskIds);

    const connect = () => {
      socket = new window.WebSocket(taskRealtimeUrl(token));

      socket.addEventListener('open', () => {
        if (closed) {
          return;
        }

        subscribedTaskIds.forEach((subscribedTaskId) => {
          socket?.send(JSON.stringify({ type: 'subscribe', taskId: subscribedTaskId }));
        });
      });

      socket.addEventListener('message', (event) => {
        const message = parseTaskChangedEvent(event.data, subscribedTaskIdSet);

        if (!message) {
          return;
        }

        if (message.actorUserId === optionsRef.current.currentUserId) {
          return;
        }

        setNotifications((current) => [notificationFor(message), ...current].slice(0, MAX_NOTIFICATIONS));
        optionsRef.current.onExternalTaskChanged();
      });

      socket.addEventListener('close', (event) => {
        if (!closed && event.code !== 1008) {
          reconnectTimer = window.setTimeout(connect, RECONNECT_DELAY_MS);
        }
      });
    };

    connect();

    return () => {
      closed = true;

      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
      }

      if (socket?.readyState === window.WebSocket.OPEN) {
        subscribedTaskIds.forEach((subscribedTaskId) => {
          socket?.send(JSON.stringify({ type: 'unsubscribe', taskId: subscribedTaskId }));
        });
      }

      socket?.close();
    };
  }, [subscriptionKey]);

  return notifications;
};

const taskRealtimeUrl = (token: string) => {
  const url = new URL(API_URL, window.location.origin);
  const basePath = url.pathname.replace(/\/api\/?$/, '').replace(/\/$/, '');

  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = `${basePath}/ws/tasks`;
  url.searchParams.set('token', token);
  return url.toString();
};

const parseTaskChangedEvent = (data: unknown, taskIds: Set<string>): TaskChangedEvent | null => {
  if (typeof data !== 'string') {
    return null;
  }

  try {
    const message = JSON.parse(data) as Partial<TaskChangedEvent>;

    return message.type === 'task.changed' &&
      typeof message.taskId === 'string' &&
      taskIds.has(message.taskId) &&
      isTaskChangedAction(message.action) &&
      typeof message.actorUserId === 'string' &&
      typeof message.occurredAt === 'string'
      ? (message as TaskChangedEvent)
      : null;
  } catch {
    return null;
  }
};

const notificationFor = (event: TaskChangedEvent): TaskRealtimeNotification => ({
  id: `${event.taskId}-${event.action}-${event.occurredAt}`,
  message: ACTION_MESSAGES[event.action],
  occurredAt: event.occurredAt,
});

const isTaskChangedAction = (value: unknown): value is TaskChangedAction =>
  typeof value === 'string' && value in ACTION_MESSAGES;

const uniqueTaskIds = (taskIds: string[]) =>
  [...new Set(taskIds.filter((taskId) => taskId.trim().length > 0))].sort();

import { TASK_PRIORITY, TASK_STATUS, type Task, type TaskPriority } from '../types';

export const formatEnumLabel = (value: string) =>
  value
    .toLowerCase()
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');

export const formatShortDateTime = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));

export const formatFullDateTime = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));

export const priorityBadgeClass = (priority: TaskPriority) => {
  const className = {
    [TASK_PRIORITY.Low]: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    [TASK_PRIORITY.Medium]: 'border-amber-200 bg-amber-50 text-amber-800',
    [TASK_PRIORITY.High]: 'border-rose-200 bg-rose-50 text-rose-800',
  }[priority];

  return className;
};

export const buildTaskStats = (tasks: Task[]) => ({
  open: tasks.filter((task) => task.status !== TASK_STATUS.Done).length,
  inProgress: tasks.filter((task) => task.status === TASK_STATUS.InProgress).length,
  done: tasks.filter((task) => task.status === TASK_STATUS.Done).length,
  highPriority: tasks.filter((task) => task.priority === TASK_PRIORITY.High).length,
});

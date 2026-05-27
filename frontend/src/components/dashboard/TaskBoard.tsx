import { Link } from 'react-router-dom';
import { ClipboardList, Trash2 } from 'lucide-react';
import { TASK_STATUSES } from '../../types';
import type { Task, UpdateTaskInput } from '../../types';
import { EmptyState } from '../ui/EmptyState';
import { LoadingState } from '../ui/LoadingState';
import { PriorityBadge } from './PriorityBadge';
import { formatEnumLabel } from '../../utils/taskFormatting';

interface TaskSurfaceProps {
  tasks: Task[];
  loading: boolean;
  onUpdate: (taskId: string, taskData: UpdateTaskInput) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
}

export const TaskBoard = ({ tasks, loading, onUpdate, onDelete }: TaskSurfaceProps) => {
  if (loading) {
    return <LoadingState label="Loading board..." />;
  }

  if (tasks.length === 0) {
    return <DashboardEmptyState />;
  }

  return (
    <section aria-label="Task board" className="grid gap-4 lg:grid-cols-3">
      {TASK_STATUSES.map((status) => {
        const columnTasks = tasks.filter((task) => task.status === status);

        return (
          <div key={status} className="min-h-80 rounded-lg border border-zinc-200 bg-white">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <h2 className="text-sm font-bold text-zinc-900">{formatEnumLabel(status)}</h2>
              <span className="rounded bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-600">
                {columnTasks.length}
              </span>
            </div>
            <div className="grid gap-3 p-3">
              {columnTasks.length === 0 ? (
                <p className="rounded border border-dashed border-zinc-300 px-3 py-6 text-center text-sm text-zinc-500">
                  No tasks here.
                </p>
              ) : (
                columnTasks.map((task) => (
                  <TaskCard key={task.id} task={task} onUpdate={onUpdate} onDelete={onDelete} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
};

const TaskCard = ({ task, onUpdate, onDelete }: { task: Task } & Pick<TaskSurfaceProps, 'onUpdate' | 'onDelete'>) => (
  <article className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-cyan-200 hover:shadow-md">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <Link to={`/tasks/${task.id}`} className="block truncate text-base font-bold text-zinc-950 hover:text-cyan-700">
          {task.title}
        </Link>
        <p className="mt-1 line-clamp-2 text-sm text-zinc-600">{task.description || 'No description yet.'}</p>
      </div>
      <PriorityBadge priority={task.priority} />
    </div>

    <div className="mt-4 flex flex-wrap items-center gap-2">
      {TASK_STATUSES.map((status) => (
        <button
          key={status}
          type="button"
          onClick={() => onUpdate(task.id, { status })}
          disabled={task.status === status}
          className={`rounded border px-2 py-1 text-xs font-semibold ${
            task.status === status
              ? 'border-zinc-950 bg-zinc-950 text-white'
              : 'border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50'
          } disabled:cursor-default`}
        >
          {formatEnumLabel(status)}
        </button>
      ))}
    </div>

    <div className="mt-4 flex items-center justify-between gap-2 border-t border-zinc-100 pt-3">
      <Link to={`/tasks/${task.id}`} className="text-sm font-semibold text-cyan-700 hover:text-cyan-900">
        Open details
      </Link>
      <button
        type="button"
        onClick={() => onDelete(task.id)}
        className="inline-flex items-center gap-1 rounded border border-red-200 px-2 py-1 text-sm font-semibold text-red-700 hover:bg-red-50"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        Delete
      </button>
    </div>
  </article>
);

const DashboardEmptyState = () => (
  <EmptyState
    icon={ClipboardList}
    title="No tasks match this view"
    body="Create a task or loosen the filters to bring work back into the list."
  />
);

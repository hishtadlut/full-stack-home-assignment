import { Link } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';
import { TASK_STATUSES } from '../../types';
import type { Task, TaskStatus, UpdateTaskInput } from '../../types';
import { EmptyState } from '../ui/EmptyState';
import { LoadingState } from '../ui/LoadingState';
import { PriorityBadge } from './PriorityBadge';
import { formatEnumLabel, formatShortDateTime } from '../../utils/taskFormatting';

interface TaskSurfaceProps {
  tasks: Task[];
  loading: boolean;
  onUpdate: (taskId: string, taskData: UpdateTaskInput) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
}

export const TaskTable = ({ tasks, loading, onUpdate, onDelete }: TaskSurfaceProps) => {
  if (loading) {
    return <LoadingState label="Loading tasks..." />;
  }

  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="No tasks match this view"
        body="Create a task or loosen the filters to bring work back into the list."
      />
    );
  }

  return (
    <section aria-label="Task table" className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50 text-left text-xs font-bold uppercase tracking-normal text-zinc-500">
            <tr>
              <th scope="col" className="px-4 py-3">Task</th>
              <th scope="col" className="px-4 py-3">Status</th>
              <th scope="col" className="px-4 py-3">Priority</th>
              <th scope="col" className="px-4 py-3">Updated</th>
              <th scope="col" className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 bg-white">
            {tasks.map((task) => (
              <tr key={task.id} className="hover:bg-zinc-50">
                <td className="max-w-md px-4 py-4">
                  <Link to={`/tasks/${task.id}`} className="font-bold text-zinc-950 hover:text-cyan-700">
                    {task.title}
                  </Link>
                  <p className="mt-1 truncate text-zinc-600">{task.description || 'No description yet.'}</p>
                </td>
                <td className="px-4 py-4">
                  <select
                    value={task.status}
                    onChange={(event) => onUpdate(task.id, { status: event.target.value as TaskStatus })}
                    className="rounded border border-zinc-300 px-2 py-1 text-sm focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                  >
                    {TASK_STATUSES.map((status) => (
                      <option key={status} value={status}>{formatEnumLabel(status)}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-4">
                  <PriorityBadge priority={task.priority} />
                </td>
                <td className="px-4 py-4 text-zinc-600">{formatShortDateTime(task.updatedAt)}</td>
                <td className="px-4 py-4">
                  <div className="flex justify-end gap-2">
                    <Link
                      to={`/tasks/${task.id}`}
                      className="rounded border border-cyan-200 px-3 py-2 font-semibold text-cyan-700 hover:bg-cyan-50"
                    >
                      Open
                    </Link>
                    <button
                      type="button"
                      onClick={() => onDelete(task.id)}
                      className="rounded border border-red-200 px-3 py-2 font-semibold text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

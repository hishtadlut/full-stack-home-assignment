import { Link } from 'react-router-dom';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import type { Task } from '../../types';
import { buttonStyles } from '../ui/buttonStyles';

interface TaskDetailHeaderProps {
  task: Task;
  editing: boolean;
  saving: boolean;
  error: string | null;
  onToggleEdit: () => void;
  onDelete: () => Promise<void> | void;
}

export const TaskDetailHeader = ({
  task,
  editing,
  saving,
  error,
  onToggleEdit,
  onDelete,
}: TaskDetailHeaderProps) => (
  <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-700 hover:text-cyan-900">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to dashboard
        </Link>
        <h1 className="mt-3 break-words text-3xl font-bold tracking-normal text-zinc-950">{task.title}</h1>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-600">
          {task.description || 'No description yet.'}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <button type="button" onClick={onToggleEdit} className={buttonStyles('secondary')}>
          <Pencil className="h-4 w-4" aria-hidden="true" />
          {editing ? 'Close Edit' : 'Edit'}
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={saving}
          className={`${buttonStyles('danger')} disabled:cursor-not-allowed disabled:opacity-60`}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Delete
        </button>
      </div>
    </div>

    {error && (
      <div role="alert" className="mt-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
        {error}
      </div>
    )}
  </div>
);

import { TaskForm } from '../TaskForm';
import { buttonStyles } from '../ui/buttonStyles';
import type { TaskEditableFields } from '../../types';

interface CreateTaskDialogProps {
  busy: boolean;
  onClose: () => void;
  onSubmit: (taskData: TaskEditableFields) => Promise<void> | void;
}

export const CreateTaskDialog = ({ busy, onClose, onSubmit }: CreateTaskDialogProps) => (
  <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-zinc-950/30 px-4 py-8">
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-task-title"
      className="w-full max-w-xl rounded-lg border border-zinc-200 bg-white p-5 shadow-2xl"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-cyan-700">Task</p>
          <h2 id="new-task-title" className="text-xl font-bold text-zinc-950">Create a new task</h2>
        </div>
        <button type="button" onClick={onClose} className={buttonStyles('secondary')}>
          Cancel
        </button>
      </div>
      <TaskForm onSubmit={onSubmit} busy={busy} />
    </section>
  </div>
);

import { TaskForm } from '../TaskForm';
import type { TaskEditableFields } from '../../types';

interface TaskEditPanelProps {
  busy: boolean;
  initialValues: TaskEditableFields;
  onSubmit: (fields: TaskEditableFields) => Promise<void> | void;
}

export const TaskEditPanel = ({ busy, initialValues, onSubmit }: TaskEditPanelProps) => (
  <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm" aria-labelledby="edit-task-title">
    <h2 id="edit-task-title" className="mb-4 text-lg font-bold text-zinc-950">Edit task fields</h2>
    <TaskForm
      initialValues={initialValues}
      onSubmit={onSubmit}
      submitLabel="Save changes"
      busy={busy}
    />
  </section>
);

import { useEffect, useState, type FormEvent } from 'react';
import { TASK_PRIORITIES, TASK_PRIORITY, TASK_STATUSES, TASK_STATUS } from '../types';
import type { TaskEditableFields, TaskPriority, TaskStatus } from '../types';

interface TaskFormProps {
  onSubmit: (taskData: TaskEditableFields) => Promise<void> | void;
  initialValues?: TaskEditableFields;
  submitLabel?: string;
  busy?: boolean;
}

const blankTask: TaskEditableFields = {
  title: '',
  description: '',
  status: TASK_STATUS.Todo,
  priority: TASK_PRIORITY.Medium,
};

export const TaskForm = ({
  onSubmit,
  initialValues = blankTask,
  submitLabel = 'Create Task',
  busy = false,
}: TaskFormProps) => {
  const [formData, setFormData] = useState<TaskEditableFields>({
    ...initialValues,
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFormData(initialValues);
  }, [initialValues]);

  const handleFieldChange = <Field extends keyof TaskEditableFields>(
    field: Field,
    value: TaskEditableFields[Field],
  ) => {
    setFormData((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (formData.title.trim().length === 0) {
      setError('Title is required');
      return;
    }

    await onSubmit({
      ...formData,
      title: formData.title.trim(),
      description: formData.description.trim(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="task-title" className="block text-sm font-medium mb-1">Title</label>
        <input
          id="task-title"
          type="text"
          name="title"
          value={formData.title}
          onChange={(e) => handleFieldChange('title', e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-100"
          required
        />
      </div>
      <div>
        <label htmlFor="task-description" className="block text-sm font-medium mb-1">Description</label>
        <textarea
          id="task-description"
          name="description"
          value={formData.description}
          onChange={(e) => handleFieldChange('description', e.target.value)}
          className="w-full resize-none rounded border border-gray-300 px-3 py-2 text-sm focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-100"
          rows={4}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="task-status" className="block text-sm font-medium mb-1">Status</label>
          <select
            id="task-status"
            name="status"
            value={formData.status}
            onChange={(e) => handleFieldChange('status', e.target.value as TaskStatus)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-100"
          >
            {TASK_STATUSES.map((status) => (
              <option key={status} value={status}>
                {formatOption(status)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="task-priority" className="block text-sm font-medium mb-1">Priority</label>
          <select
            id="task-priority"
            name="priority"
            value={formData.priority}
            onChange={(e) => handleFieldChange('priority', e.target.value as TaskPriority)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-100"
          >
            {TASK_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {formatOption(priority)}
              </option>
            ))}
          </select>
        </div>
      </div>
      {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded bg-cyan-700 py-2 text-sm font-semibold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-gray-300"
      >
        {busy ? 'Saving...' : submitLabel}
      </button>
    </form>
  );
};

const formatOption = (value: string) =>
  value
    .toLowerCase()
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');

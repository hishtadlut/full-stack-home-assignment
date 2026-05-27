import {
  TASK_PRIORITIES,
  TASK_PRIORITY,
  TASK_STATUSES,
  TASK_STATUS,
  type AssistantDraftOperation,
  type CreateTaskInput,
  type UpdateTaskInput,
} from '../../types';

interface DraftOperationFormProps {
  operation: AssistantDraftOperation;
  disabled: boolean;
  onChange: (operation: AssistantDraftOperation) => void;
}

export const DraftOperationForm = ({ operation, disabled, onChange }: DraftOperationFormProps) => (
  <div className="rounded border border-gray-200 bg-gray-50 p-3">
    <div className="mb-3 flex items-center justify-between gap-2">
      <p className="text-sm font-semibold text-gray-900">{operation.label}</p>
      <span className="rounded bg-white px-2 py-1 text-xs text-gray-600">{operation.type}</span>
    </div>
    {renderOperationFields(operation, disabled, onChange)}
  </div>
);

const renderOperationFields = (
  operation: AssistantDraftOperation,
  disabled: boolean,
  onChange: (operation: AssistantDraftOperation) => void,
) => {
  switch (operation.type) {
    case 'create_task':
      return (
        <TaskFields
          input={operation.input}
          disabled={disabled}
          onChange={(input) => onChange({ ...operation, input })}
        />
      );

    case 'update_task':
      return (
        <div className="space-y-3">
          <TextInput
            label="Task id"
            value={operation.taskId}
            disabled={disabled}
            onChange={(taskId) => onChange({ ...operation, taskId })}
          />
          <TaskPatchFields
            patch={operation.patch}
            disabled={disabled}
            onChange={(patch) => onChange({ ...operation, patch })}
          />
        </div>
      );

    case 'delete_task':
      return (
        <div className="space-y-3">
          <p role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            This will delete the selected task after approval.
          </p>
          <TextInput
            label="Task id"
            value={operation.taskId}
            disabled={disabled}
            onChange={(taskId) => onChange({ ...operation, taskId })}
          />
        </div>
      );

    case 'create_comment':
      return (
        <div className="space-y-3">
          <TextInput
            label="Task id"
            value={operation.taskId}
            disabled={disabled}
            onChange={(taskId) => onChange({ ...operation, taskId })}
          />
          <TextareaInput
            label="Comment"
            value={operation.input.content}
            disabled={disabled}
            onChange={(content) => onChange({ ...operation, input: { content } })}
          />
        </div>
      );

    case 'delete_comment':
      return (
        <div className="space-y-3">
          <p role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            This will delete the selected comment after approval.
          </p>
          <TextInput
            label="Comment id"
            value={operation.commentId}
            disabled={disabled}
            onChange={(commentId) => onChange({ ...operation, commentId })}
          />
        </div>
      );
  }
};

interface TaskFieldsProps {
  input: CreateTaskInput;
  disabled: boolean;
  onChange: (input: CreateTaskInput) => void;
}

const TaskFields = ({ input, disabled, onChange }: TaskFieldsProps) => (
  <div className="grid gap-3">
    <TextInput
      label="Title"
      value={input.title}
      disabled={disabled}
      onChange={(title) => onChange({ ...input, title })}
    />
    <TextareaInput
      label="Description"
      value={input.description ?? ''}
      disabled={disabled}
      onChange={(description) => onChange({ ...input, description })}
    />
    <div className="grid grid-cols-2 gap-3">
      <SelectInput
        label="Status"
        value={input.status ?? TASK_STATUS.Todo}
        values={TASK_STATUSES}
        disabled={disabled}
        onChange={(status) => onChange({ ...input, status })}
      />
      <SelectInput
        label="Priority"
        value={input.priority ?? TASK_PRIORITY.Medium}
        values={TASK_PRIORITIES}
        disabled={disabled}
        onChange={(priority) => onChange({ ...input, priority })}
      />
    </div>
  </div>
);

interface TaskPatchFieldsProps {
  patch: UpdateTaskInput;
  disabled: boolean;
  onChange: (patch: UpdateTaskInput) => void;
}

const TaskPatchFields = ({ patch, disabled, onChange }: TaskPatchFieldsProps) => (
  <div className="grid gap-3">
    {'title' in patch && (
      <TextInput
        label="Title"
        value={patch.title ?? ''}
        disabled={disabled}
        onChange={(title) => onChange({ ...patch, title })}
      />
    )}
    {'description' in patch && (
      <TextareaInput
        label="Description"
        value={patch.description ?? ''}
        disabled={disabled}
        onChange={(description) => onChange({ ...patch, description })}
      />
    )}
    <div className="grid grid-cols-2 gap-3">
      {'status' in patch && (
        <SelectInput
          label="Status"
          value={patch.status ?? TASK_STATUS.Todo}
          values={TASK_STATUSES}
          disabled={disabled}
          onChange={(status) => onChange({ ...patch, status })}
        />
      )}
      {'priority' in patch && (
        <SelectInput
          label="Priority"
          value={patch.priority ?? TASK_PRIORITY.Medium}
          values={TASK_PRIORITIES}
          disabled={disabled}
          onChange={(priority) => onChange({ ...patch, priority })}
        />
      )}
    </div>
  </div>
);

interface TextInputProps {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}

const TextInput = ({ label, value, disabled, onChange }: TextInputProps) => (
  <label className="block text-xs font-semibold text-gray-700">
    {label}
    <input
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm font-normal text-gray-900 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100 disabled:bg-gray-100"
    />
  </label>
);

const TextareaInput = ({ label, value, disabled, onChange }: TextInputProps) => (
  <label className="block text-xs font-semibold text-gray-700">
    {label}
    <textarea
      value={value}
      disabled={disabled}
      rows={3}
      onChange={(event) => onChange(event.target.value)}
      className="mt-1 w-full resize-none rounded border border-gray-300 bg-white px-3 py-2 text-sm font-normal text-gray-900 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100 disabled:bg-gray-100"
    />
  </label>
);

interface SelectInputProps<Value extends string> {
  label: string;
  value: Value;
  values: Value[];
  disabled: boolean;
  onChange: (value: Value) => void;
}

const SelectInput = <Value extends string>({
  label,
  value,
  values,
  disabled,
  onChange,
}: SelectInputProps<Value>) => (
  <label className="block text-xs font-semibold text-gray-700">
    {label}
    <select
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value as Value)}
      className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm font-normal text-gray-900 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100 disabled:bg-gray-100"
    >
      {values.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  </label>
);

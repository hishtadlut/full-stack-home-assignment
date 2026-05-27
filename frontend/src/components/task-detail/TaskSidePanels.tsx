import type { LucideIcon } from 'lucide-react';
import { CalendarClock, CheckCircle2, Pencil, Save, UserPlus, UserRound } from 'lucide-react';
import type { Task, User } from '../../types';
import { formatEnumLabel, formatFullDateTime } from '../../utils/taskFormatting';
import { buttonStyles } from '../ui/buttonStyles';

interface TaskSidePanelsProps {
  task: Task;
  users: User[];
  selectedAssigneeIds: string[];
  assignmentSaving: boolean;
  assignmentsChanged: boolean;
  canManageAssignments: boolean;
  onAssigneeToggle: (userId: string) => void;
  onSaveAssignments: () => Promise<void> | void;
}

export const TaskSidePanels = ({
  task,
  users,
  selectedAssigneeIds,
  assignmentSaving,
  assignmentsChanged,
  canManageAssignments,
  onAssigneeToggle,
  onSaveAssignments,
}: TaskSidePanelsProps) => (
  <aside className="grid h-max gap-4">
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm" aria-labelledby="task-properties-title">
      <h2 id="task-properties-title" className="text-lg font-bold text-zinc-950">Task properties</h2>
      <dl className="mt-4 grid gap-4 text-sm">
        <Property label="Status" value={formatEnumLabel(task.status)} icon={CheckCircle2} />
        <Property label="Priority" value={formatEnumLabel(task.priority)} icon={Pencil} />
        <Property label="Created" value={formatFullDateTime(task.createdAt)} icon={CalendarClock} />
        <Property label="Updated" value={formatFullDateTime(task.updatedAt)} icon={CalendarClock} />
      </dl>
    </section>

    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm" aria-labelledby="assignments-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="assignments-title" className="text-lg font-bold text-zinc-950">Assignments</h2>
        {canManageAssignments && (
          <UserPlus className="h-5 w-5 text-cyan-700" aria-hidden="true" />
        )}
      </div>
      {canManageAssignments ? (
        <AssignmentEditor
          users={users}
          selectedAssigneeIds={selectedAssigneeIds}
          assignmentSaving={assignmentSaving}
          assignmentsChanged={assignmentsChanged}
          onAssigneeToggle={onAssigneeToggle}
          onSaveAssignments={onSaveAssignments}
        />
      ) : (
        <AssignmentList task={task} />
      )}
    </section>
  </aside>
);

interface AssignmentEditorProps {
  users: User[];
  selectedAssigneeIds: string[];
  assignmentSaving: boolean;
  assignmentsChanged: boolean;
  onAssigneeToggle: (userId: string) => void;
  onSaveAssignments: () => Promise<void> | void;
}

const AssignmentEditor = ({
  users,
  selectedAssigneeIds,
  assignmentSaving,
  assignmentsChanged,
  onAssigneeToggle,
  onSaveAssignments,
}: AssignmentEditorProps) => {
  const selectedIds = new Set(selectedAssigneeIds);

  return (
    <div className="mt-4 grid gap-3">
      {users.length > 0 ? (
        <div className="grid max-h-72 gap-2 overflow-y-auto pr-1">
          {users.map((user) => (
            <label
              key={user.id}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
            >
              <input
                type="checkbox"
                checked={selectedIds.has(user.id)}
                disabled={assignmentSaving}
                onChange={() => onAssigneeToggle(user.id)}
                className="h-4 w-4 rounded border-zinc-300 text-cyan-700 focus:ring-cyan-600"
              />
              <span className="min-w-0">
                <span className="block truncate font-semibold text-zinc-800">{displayUser(user)}</span>
                <span className="block truncate text-xs text-zinc-500">{user.email}</span>
              </span>
            </label>
          ))}
        </div>
      ) : (
        <p className="rounded border border-dashed border-zinc-300 px-3 py-6 text-center text-sm text-zinc-500">
          No users available.
        </p>
      )}
      <button
        type="button"
        onClick={onSaveAssignments}
        disabled={assignmentSaving || !assignmentsChanged}
        className={`${buttonStyles('primary')} justify-center disabled:cursor-not-allowed disabled:opacity-60`}
      >
        <Save className="h-4 w-4" aria-hidden="true" />
        {assignmentSaving ? 'Saving...' : 'Save Assignments'}
      </button>
    </div>
  );
};

const AssignmentList = ({ task }: { task: Task }) => (
  <div className="mt-4 grid gap-2">
    {task.assignments && task.assignments.length > 0 ? (
      task.assignments.map((assignment) => (
        <div key={assignment.id} className="flex items-center gap-2 rounded border border-zinc-200 px-3 py-2">
          <UserRound className="h-4 w-4 text-zinc-500" aria-hidden="true" />
          <span className="text-sm font-medium text-zinc-700">
            {assignment.user ? displayUser(assignment.user) : assignment.userId}
          </span>
        </div>
      ))
    ) : (
      <p className="rounded border border-dashed border-zinc-300 px-3 py-6 text-center text-sm text-zinc-500">
        No assignees yet.
      </p>
    )}
  </div>
);

interface PropertyProps {
  label: string;
  value: string;
  icon: LucideIcon;
}

const Property = ({ label, value, icon: Icon }: PropertyProps) => (
  <div className="flex items-start gap-3">
    <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded bg-zinc-100 text-zinc-600">
      <Icon className="h-4 w-4" aria-hidden="true" />
    </span>
    <div>
      <dt className="font-semibold text-zinc-500">{label}</dt>
      <dd className="font-bold text-zinc-950">{value}</dd>
    </div>
  </div>
);

const displayUser = (user: User) =>
  user.name || user.username || user.email;

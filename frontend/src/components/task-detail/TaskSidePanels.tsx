import type { LucideIcon } from 'lucide-react';
import { CalendarClock, CheckCircle2, Pencil, UserRound } from 'lucide-react';
import type { Task } from '../../types';
import { formatEnumLabel, formatFullDateTime } from '../../utils/taskFormatting';

interface TaskSidePanelsProps {
  task: Task;
}

export const TaskSidePanels = ({ task }: TaskSidePanelsProps) => (
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
      <h2 id="assignments-title" className="text-lg font-bold text-zinc-950">Assignments</h2>
      <div className="mt-4 grid gap-2">
        {task.assignments && task.assignments.length > 0 ? (
          task.assignments.map((assignment) => (
            <div key={assignment.id} className="flex items-center gap-2 rounded border border-zinc-200 px-3 py-2">
              <UserRound className="h-4 w-4 text-zinc-500" aria-hidden="true" />
              <span className="text-sm font-medium text-zinc-700">
                {assignment.user?.name || assignment.user?.username || assignment.userId}
              </span>
            </div>
          ))
        ) : (
          <p className="rounded border border-dashed border-zinc-300 px-3 py-6 text-center text-sm text-zinc-500">
            No assignees yet.
          </p>
        )}
      </div>
    </section>
  </aside>
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

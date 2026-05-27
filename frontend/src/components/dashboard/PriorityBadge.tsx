import type { TaskPriority } from '../../types';
import { formatEnumLabel, priorityBadgeClass } from '../../utils/taskFormatting';

export const PriorityBadge = ({ priority }: { priority: TaskPriority }) => (
  <span className={`shrink-0 rounded border px-2 py-1 text-xs font-bold ${priorityBadgeClass(priority)}`}>
    {formatEnumLabel(priority)}
  </span>
);

import { Search } from 'lucide-react';
import { TASK_PRIORITIES, TASK_STATUSES } from '../../types';
import type { TaskPriority, TaskStatus } from '../../types';
import { formatEnumLabel } from '../../utils/taskFormatting';
import type { PriorityFilter, StatusFilter } from '../../hooks/useTaskFilters';

interface TaskFiltersBarProps {
  search: string;
  status: StatusFilter;
  priority: PriorityFilter;
  resultCount: number;
  hasFilters: boolean;
  onFilterChange: (key: string, value?: string) => void;
  onClearFilters: () => void;
}

export const TaskFiltersBar = ({
  search,
  status,
  priority,
  resultCount,
  hasFilters,
  onFilterChange,
  onClearFilters,
}: TaskFiltersBarProps) => (
  <section className="grid gap-4 border-y border-zinc-200 bg-white px-4 py-4 shadow-sm sm:rounded-lg sm:border">
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end">
      <label className="block text-sm font-semibold text-zinc-700">
        Search
        <span className="relative mt-1 block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
          <input
            value={search}
            onChange={(event) => onFilterChange('search', event.target.value)}
            placeholder="Search task titles or descriptions"
            className="w-full rounded border border-zinc-300 py-2 pl-9 pr-3 text-sm font-normal focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-100"
          />
        </span>
      </label>

      <SelectFilter
        label="Status"
        allLabel="All statuses"
        value={status}
        values={['ALL', ...TASK_STATUSES]}
        onChange={(value) => onFilterChange('status', value)}
      />
      <SelectFilter
        label="Priority"
        allLabel="All priorities"
        value={priority}
        values={['ALL', ...TASK_PRIORITIES]}
        onChange={(value) => onFilterChange('priority', value)}
      />
    </div>

    {hasFilters && (
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-3">
        <p className="text-sm text-zinc-600">
          Showing {resultCount} result{resultCount === 1 ? '' : 's'} for the current filters.
        </p>
        <button
          type="button"
          onClick={onClearFilters}
          className="rounded border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Clear filters
        </button>
      </div>
    )}
  </section>
);

interface SelectFilterProps<Value extends string> {
  label: string;
  allLabel: string;
  value: Value;
  values: Value[];
  onChange: (value: Value) => void;
}

const SelectFilter = <Value extends string>({ label, allLabel, value, values, onChange }: SelectFilterProps<Value>) => (
  <label className="block min-w-44 text-sm font-semibold text-zinc-700">
    {label}
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as Value)}
      className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm font-normal focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-100"
    >
      {values.map((option) => (
        <option key={option} value={option}>
          {option === 'ALL' ? allLabel : formatEnumLabel(option)}
        </option>
      ))}
    </select>
  </label>
);

export type DashboardStatusFilter = TaskStatus | 'ALL';
export type DashboardPriorityFilter = TaskPriority | 'ALL';

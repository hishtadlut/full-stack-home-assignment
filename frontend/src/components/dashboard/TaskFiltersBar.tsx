import { BookmarkPlus, Check, Search, SlidersHorizontal, X } from 'lucide-react';
import { TASK_PRIORITIES, TASK_STATUSES } from '../../types';
import type { TaskFilters, TaskPriority, TaskStatus } from '../../types';
import { formatEnumLabel } from '../../utils/taskFormatting';
import type { PriorityFilter, StatusFilter } from '../../hooks/useTaskFilters';
import type { TaskFilterPreset } from '../../hooks/useFilterPresets';

interface TaskFiltersBarProps {
  search: string;
  status: StatusFilter;
  priority: PriorityFilter;
  presets: TaskFilterPreset[];
  activePresetId: string | null;
  resultCount: number;
  hasFilters: boolean;
  onFilterChange: (key: string, value?: string) => void;
  onClearFilters: () => void;
  onSavePreset: () => void;
  onApplyPreset: (presetId: string) => void;
  onDeletePreset: (presetId: string) => void;
}

export const TaskFiltersBar = ({
  search,
  status,
  priority,
  presets,
  activePresetId,
  resultCount,
  hasFilters,
  onFilterChange,
  onClearFilters,
  onSavePreset,
  onApplyPreset,
  onDeletePreset,
}: TaskFiltersBarProps) => (
  <section className="overflow-hidden border-y border-zinc-200 bg-white shadow-sm sm:rounded-lg sm:border">
    <div className="flex flex-col gap-3 border-b border-zinc-100 bg-zinc-50 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded bg-zinc-950 text-white">
          <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-zinc-950">Task filters</p>
          <p className="truncate text-sm text-zinc-600">
            {hasFilters ? formatFilterSummary({ search, status, priority }) : 'All tasks'}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700">
          {resultCount} result{resultCount === 1 ? '' : 's'}
        </span>
        {hasFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            Clear
          </button>
        )}
      </div>
    </div>

    <div className="grid gap-3 px-4 py-4">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto_auto_auto] xl:items-end">
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

        <button
          type="button"
          onClick={onSavePreset}
          disabled={!hasFilters || Boolean(activePresetId)}
          title={!hasFilters ? 'Choose filters before saving a view' : undefined}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:text-zinc-400"
        >
          {activePresetId ? (
            <Check className="h-4 w-4" aria-hidden="true" />
          ) : (
            <BookmarkPlus className="h-4 w-4" aria-hidden="true" />
          )}
          {activePresetId ? 'Saved' : 'Save current view'}
        </button>
      </div>

      {presets.length > 0 && (
        <div className="grid gap-2 border-t border-zinc-100 pt-3 sm:grid-cols-2 xl:grid-cols-[repeat(auto-fit,minmax(16rem,1fr))]">
          {presets.map((preset) => (
            <PresetChip
              key={preset.id}
              preset={preset}
              active={preset.id === activePresetId}
              onApply={onApplyPreset}
              onDelete={onDeletePreset}
            />
          ))}
        </div>
      )}
    </div>
  </section>
);

const formatFilterSummary = ({
  search,
  status,
  priority,
}: {
  search: string;
  status: StatusFilter;
  priority: PriorityFilter;
}) => {
  const filters: TaskFilters = {
    ...(search.trim() && { search: search.trim() }),
    ...(status !== 'ALL' && { status }),
    ...(priority !== 'ALL' && { priority }),
  };

  return formatPresetFilters(filters);
};

interface PresetChipProps {
  preset: TaskFilterPreset;
  active: boolean;
  onApply: (presetId: string) => void;
  onDelete: (presetId: string) => void;
}

const PresetChip = ({ preset, active, onApply, onDelete }: PresetChipProps) => {
  const filterSummary = formatPresetFilters(preset.filters);

  return (
    <span className={`flex h-10 w-full min-w-0 overflow-hidden rounded border ${
      active
        ? 'border-cyan-300 bg-cyan-50 text-cyan-950 shadow-sm shadow-cyan-950/5'
        : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
    }`}
    >
      <button
        type="button"
        onClick={() => onApply(preset.id)}
        aria-pressed={active}
        aria-label={`Apply saved view: ${filterSummary}`}
        className="flex min-w-0 flex-1 items-center px-3 text-left"
      >
        <span className="block truncate text-sm font-semibold">{filterSummary}</span>
      </button>
      <button
        type="button"
        onClick={() => onDelete(preset.id)}
        aria-label={`Delete saved view: ${filterSummary}`}
        className={`flex h-10 w-10 shrink-0 items-center justify-center border-l ${
          active
            ? 'border-cyan-200 text-cyan-800 hover:bg-cyan-100'
            : 'border-zinc-200 text-zinc-500 hover:bg-zinc-50 hover:text-red-700'
        }`}
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </span>
  );
};

const formatPresetFilters = (filters: TaskFilters) => {
  const parts = [
    filters.search && `Search: "${truncateFilter(filters.search)}"`,
    filters.status && `Status: ${formatEnumLabel(filters.status)}`,
    filters.priority && `Priority: ${formatEnumLabel(filters.priority)}`,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' + ') : 'All tasks';
};

const truncateFilter = (value: string) =>
  value.length > 24 ? `${value.slice(0, 21)}...` : value;

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

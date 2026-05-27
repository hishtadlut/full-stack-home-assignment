import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TASK_PRIORITIES, TASK_STATUSES } from '../types';
import type { TaskFilters, TaskPriority, TaskStatus } from '../types';

export type DashboardView = 'board' | 'table';
export type StatusFilter = TaskStatus | 'ALL';
export type PriorityFilter = TaskPriority | 'ALL';

export const useTaskFilters = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get('search') ?? '';
  const status = parseStatusFilter(searchParams.get('status'));
  const priority = parsePriorityFilter(searchParams.get('priority'));
  const view = parseDashboardView(searchParams.get('view'));

  const filters = useMemo<TaskFilters>(
    () => ({
      search: search.trim() || undefined,
      status: status === 'ALL' ? undefined : status,
      priority: priority === 'ALL' ? undefined : priority,
    }),
    [priority, search, status],
  );

  const hasFilters = Boolean(filters.search || filters.status || filters.priority);

  const setFilterParam = (key: string, value?: string) => {
    const nextParams = new URLSearchParams(searchParams);

    if (!value || value === 'ALL') {
      nextParams.delete(key);
    } else {
      nextParams.set(key, value);
    }

    setSearchParams(nextParams);
  };

  const clearFilters = () => {
    setSearchParams(view === 'board' ? {} : { view });
  };

  return {
    search,
    status,
    priority,
    view,
    filters,
    hasFilters,
    setFilterParam,
    clearFilters,
  };
};

const parseDashboardView = (value: string | null): DashboardView =>
  value === 'table' ? 'table' : 'board';

const parseStatusFilter = (value: string | null): StatusFilter =>
  value && TASK_STATUSES.includes(value as TaskStatus) ? (value as TaskStatus) : 'ALL';

const parsePriorityFilter = (value: string | null): PriorityFilter =>
  value && TASK_PRIORITIES.includes(value as TaskPriority) ? (value as TaskPriority) : 'ALL';

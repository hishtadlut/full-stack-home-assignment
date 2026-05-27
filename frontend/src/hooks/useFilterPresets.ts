import { useCallback, useEffect, useMemo, useState } from 'react';
import { TASK_PRIORITIES, TASK_STATUSES } from '../types';
import type { TaskFilters, TaskPriority, TaskStatus } from '../types';

const FILTER_PRESET_STORAGE_PREFIX = 'task-manager.filter-presets';
const FILTER_PRESET_LIMIT = 8;

export interface TaskFilterPreset {
  id: string;
  filters: TaskFilters;
  createdAt: string;
  updatedAt: string;
}

export const useFilterPresets = (userId?: string | null) => {
  const storageKey = useMemo(
    () => `${FILTER_PRESET_STORAGE_PREFIX}:${userId ?? 'anonymous'}`,
    [userId],
  );
  const [presets, setPresets] = useState<TaskFilterPreset[]>([]);

  useEffect(() => {
    setPresets(readPresets(storageKey));
  }, [storageKey]);

  const persistPresets = useCallback((
    updater: (currentPresets: TaskFilterPreset[]) => TaskFilterPreset[],
  ) => {
    setPresets((currentPresets) => {
      const nextPresets = updater(currentPresets);
      writePresets(storageKey, nextPresets);
      return nextPresets;
    });
  }, [storageKey]);

  const savePreset = useCallback((filters: TaskFilters) => {
    const normalizedFilters = normalizeFilters(filters);

    if (!hasAnyFilter(normalizedFilters)) {
      throw new Error('Choose at least one filter before saving a view');
    }

    const now = new Date().toISOString();

    persistPresets((currentPresets) => {
      const existingPreset = currentPresets.find(
        (preset) => filtersAreEqual(preset.filters, normalizedFilters),
      );

      if (existingPreset) {
        return [
          {
            ...existingPreset,
            filters: normalizedFilters,
            updatedAt: now,
          },
          ...currentPresets.filter((preset) => preset.id !== existingPreset.id),
        ].slice(0, FILTER_PRESET_LIMIT);
      }

      return [
        {
          id: createPresetId(),
          filters: normalizedFilters,
          createdAt: now,
          updatedAt: now,
        },
        ...currentPresets,
      ].slice(0, FILTER_PRESET_LIMIT);
    });
  }, [persistPresets]);

  const deletePreset = useCallback((presetId: string) => {
    persistPresets((currentPresets) =>
      currentPresets.filter((preset) => preset.id !== presetId),
    );
  }, [persistPresets]);

  return {
    presets,
    savePreset,
    deletePreset,
  };
};

export const findMatchingPresetId = (
  presets: TaskFilterPreset[],
  filters: TaskFilters,
) =>
  presets.find((preset) => filtersAreEqual(preset.filters, filters))?.id ?? null;

const normalizeFilters = (filters: TaskFilters): TaskFilters => ({
  ...(filters.search?.trim() && { search: filters.search.trim() }),
  ...(filters.status && TASK_STATUSES.includes(filters.status) && { status: filters.status }),
  ...(filters.priority && TASK_PRIORITIES.includes(filters.priority) && { priority: filters.priority }),
});

const hasAnyFilter = (filters: TaskFilters) =>
  Boolean(filters.search || filters.status || filters.priority);

const filtersAreEqual = (left: TaskFilters, right: TaskFilters) => {
  const normalizedLeft = normalizeFilters(left);
  const normalizedRight = normalizeFilters(right);

  return (
    (normalizedLeft.search ?? '') === (normalizedRight.search ?? '') &&
    normalizedLeft.status === normalizedRight.status &&
    normalizedLeft.priority === normalizedRight.priority
  );
};

const readPresets = (storageKey: string): TaskFilterPreset[] => {
  try {
    const rawValue = window.localStorage.getItem(storageKey);

    if (!rawValue) {
      return [];
    }

    const parsedValue = JSON.parse(rawValue);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue
      .map(toPreset)
      .filter((preset): preset is TaskFilterPreset => Boolean(preset))
      .slice(0, FILTER_PRESET_LIMIT);
  } catch {
    return [];
  }
};

const writePresets = (storageKey: string, presets: TaskFilterPreset[]) => {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(presets));
  } catch {
    // Saving presets is a convenience feature; the dashboard filters still work without storage.
  }
};

const toPreset = (value: unknown): TaskFilterPreset | null => {
  if (!isRecord(value) || !isRecord(value.filters)) {
    return null;
  }

  if (typeof value.id !== 'string') {
    return null;
  }

  return {
    id: value.id,
    filters: normalizeFilters({
      search: typeof value.filters.search === 'string' ? value.filters.search : undefined,
      status: isTaskStatus(value.filters.status) ? value.filters.status : undefined,
      priority: isTaskPriority(value.filters.priority) ? value.filters.priority : undefined,
    }),
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
  };
};

const createPresetId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `preset-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const isTaskStatus = (value: unknown): value is TaskStatus =>
  typeof value === 'string' && TASK_STATUSES.includes(value as TaskStatus);

const isTaskPriority = (value: unknown): value is TaskPriority =>
  typeof value === 'string' && TASK_PRIORITIES.includes(value as TaskPriority);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

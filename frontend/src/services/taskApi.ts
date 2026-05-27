import { api } from './api';
import type { CreateTaskInput, Task, TaskFilters, UpdateTaskInput } from '../types';

export const taskApi = {
  async listTasks(filters?: TaskFilters) {
    const queryString = taskFiltersToQueryString(filters);
    return api.get<Task[]>(`/tasks${queryString ? `?${queryString}` : ''}`);
  },

  async getTask(taskId: string) {
    return api.get<Task>(`/tasks/${taskId}`);
  },

  async createTask(taskData: CreateTaskInput) {
    return api.post<Task>('/tasks', taskData);
  },

  async updateTask(taskId: string, taskData: UpdateTaskInput) {
    return api.patch<Task>(`/tasks/${taskId}`, taskData);
  },

  async deleteTask(taskId: string) {
    await api.delete(`/tasks/${taskId}`);
  },
};

const taskFiltersToQueryString = (filters?: TaskFilters) => {
  const queryParams = new URLSearchParams();

  if (filters?.search) {
    queryParams.set('search', filters.search);
  }

  if (filters?.status) {
    queryParams.set('status', filters.status);
  }

  if (filters?.priority) {
    queryParams.set('priority', filters.priority);
  }

  return queryParams.toString();
};

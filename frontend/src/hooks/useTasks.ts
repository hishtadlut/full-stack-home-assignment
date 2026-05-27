import { useState, useEffect } from 'react';
import { taskApi } from '../services/taskApi';
import type { CreateTaskInput, Task, TaskFilters, UpdateTaskInput } from '../types';

export const useTasks = (filters?: TaskFilters) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchTasks();
  }, [filters]);

  const fetchTasks = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await taskApi.listTasks(filters);
      setTasks(data);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const createTask = async (taskData: CreateTaskInput) => {
    const newTask = await taskApi.createTask(taskData);
    setTasks((currentTasks) => [newTask, ...currentTasks]);
    return newTask;
  };

  const updateTask = async (id: string, taskData: UpdateTaskInput) => {
    const updatedTask = await taskApi.updateTask(id, taskData);
    setTasks((currentTasks) => currentTasks.map((task) => (task.id === id ? updatedTask : task)));
    return updatedTask;
  };

  const deleteTask = async (id: string) => {
    await taskApi.deleteTask(id);
    setTasks((currentTasks) => currentTasks.filter((task) => task.id !== id));
  };

  return {
    tasks,
    loading,
    error,
    createTask,
    updateTask,
    deleteTask,
    refetch: fetchTasks,
  };
};

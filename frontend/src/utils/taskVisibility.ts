import type { Task } from '../types';

export const isTaskAssignedToUser = (task: Task, userId: string | null | undefined) =>
  Boolean(userId && task.assignments?.some((assignment) => assignment.userId === userId));

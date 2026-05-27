export interface User {
  id: string;
  email: string;
  username: string;
  name: string | null;
}

type ValueOf<T> = T[keyof T];

export const TASK_STATUS = {
  Todo: 'TODO',
  InProgress: 'IN_PROGRESS',
  Done: 'DONE',
} as const;

export type TaskStatus = ValueOf<typeof TASK_STATUS>;

export const TASK_STATUSES: TaskStatus[] = Object.values(TASK_STATUS);

export const TASK_PRIORITY = {
  Low: 'LOW',
  Medium: 'MEDIUM',
  High: 'HIGH',
} as const;

export type TaskPriority = ValueOf<typeof TASK_PRIORITY>;

export const TASK_PRIORITIES: TaskPriority[] = Object.values(TASK_PRIORITY);

export type TaskFilters = {
  search?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
};

export interface TaskEditableFields {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
}

export type UpdateTaskInput = Partial<CreateTaskInput>;

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  userId: string;
  createdAt: string;
  updatedAt: string;
  user?: User;
  assignments?: TaskAssignment[];
  comments?: Comment[];
}

export interface TaskAssignment {
  id: string;
  taskId: string;
  userId: string;
  user?: User;
}

export interface Comment {
  id: string;
  content: string;
  taskId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  user?: User;
}

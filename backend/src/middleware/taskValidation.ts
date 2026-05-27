import { NextFunction, Request, Response } from 'express';
import { TASK_PRIORITIES, TASK_SEARCH_MAX_LENGTH, TASK_STATUSES } from '../constants/task';
import { hasAnyField, hasField, hasText, hasValue, isOneOf, isString } from './validation';

const TASK_EDITABLE_FIELDS = ['title', 'description', 'status', 'priority'] as const;

export const validateTaskListQuery = (req: Request, res: Response, next: NextFunction) => {
  const { search, status, priority } = req.query;

  if (hasValue(search)) {
    if (!isString(search)) {
      return res.status(400).json({ error: 'Search must be a single string' });
    }

    if (search.trim().length > TASK_SEARCH_MAX_LENGTH) {
      return res.status(400).json({ error: `Search must be ${TASK_SEARCH_MAX_LENGTH} characters or fewer` });
    }
  }

  if (hasValue(status) && !isOneOf(status, TASK_STATUSES)) {
    return res.status(400).json({ error: 'Invalid task status' });
  }

  if (hasValue(priority) && !isOneOf(priority, TASK_PRIORITIES)) {
    return res.status(400).json({ error: 'Invalid task priority' });
  }

  next();
};

export const validateCreateTask = (req: Request, res: Response, next: NextFunction) => {
  const body = req.body as Record<string, unknown>;
  const { title } = body;

  if (!hasText(title)) {
    return res.status(400).json({ error: 'Title is required' });
  }

  if (hasValue(body.description) && !isString(body.description)) {
    return res.status(400).json({ error: 'Description must be a string or null' });
  }

  if (body.status !== undefined && !isOneOf(body.status, TASK_STATUSES)) {
    return res.status(400).json({ error: 'Invalid task status' });
  }

  if (body.priority !== undefined && !isOneOf(body.priority, TASK_PRIORITIES)) {
    return res.status(400).json({ error: 'Invalid task priority' });
  }

  req.body = {
    ...body,
    title: title.trim(),
  };

  next();
};

export const validateUpdateTask = (req: Request, res: Response, next: NextFunction) => {
  const body = req.body as Record<string, unknown>;

  if (!hasAnyField(body, TASK_EDITABLE_FIELDS)) {
    return res.status(400).json({ error: 'At least one task field must be provided' });
  }

  if (hasField(body, 'title')) {
    const { title } = body;

    if (!hasText(title)) {
      return res.status(400).json({ error: 'Title is required' });
    }

    body.title = title.trim();
  }

  if (hasValue(body.description) && !isString(body.description)) {
    return res.status(400).json({ error: 'Description must be a string or null' });
  }

  if (body.status !== undefined && !isOneOf(body.status, TASK_STATUSES)) {
    return res.status(400).json({ error: 'Invalid task status' });
  }

  if (body.priority !== undefined && !isOneOf(body.priority, TASK_PRIORITIES)) {
    return res.status(400).json({ error: 'Invalid task priority' });
  }

  req.body = body;
  next();
};

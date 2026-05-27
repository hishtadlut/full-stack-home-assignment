import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { isString } from '../middleware/validation';
import { isRecordNotFoundError, prisma } from '../db/prisma';
import { findTaskIdForUser, taskDetailInclude, taskListInclude } from '../db/taskQueries';

export const getTasks = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const search = isString(req.query.search) ? req.query.search.trim() : undefined;
    const status = isString(req.query.status) ? req.query.status : undefined;
    const priority = isString(req.query.priority) ? req.query.priority : undefined;

    const tasks = await prisma.task.findMany({
      where: {
        userId,
        ...(status && { status }),
        ...(priority && { priority }),
        ...(search && {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        }),
      },
      include: taskListInclude,
      orderBy: {
        updatedAt: 'desc',
      },
    });

    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
};

export const createTask = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { title, description, status, priority } = req.body;

    const task = await prisma.task.create({
      data: {
        title,
        description,
        status: status || 'TODO',
        priority: priority || 'MEDIUM',
        userId,
      },
    });

    res.status(201).json(task);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
};

export const updateTask = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const { title, description, status, priority } = req.body;

    const task = await prisma.task.update({
      where: {
        id,
        userId,
      },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(status && { status }),
        ...(priority && { priority }),
      },
      include: taskListInclude,
    });

    res.json(task);
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return res.status(404).json({ error: 'Task not found' });
    }

    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
};

export const deleteTask = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const deleted = await prisma.$transaction(async (tx) => {
      const task = await findTaskIdForUser(tx, userId, id);

      if (!task) {
        return false;
      }

      await tx.comment.deleteMany({ where: { taskId: id } });
      await tx.taskAssignment.deleteMany({ where: { taskId: id } });
      await tx.taskTag.deleteMany({ where: { taskId: id } });
      await tx.task.delete({ where: { id } });
      return true;
    });

    if (!deleted) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.status(204).send();
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return res.status(404).json({ error: 'Task not found' });
    }

    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
};

export const getTaskById = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const task = await prisma.task.findUnique({
      where: {
        id,
        userId,
      },
      include: taskDetailInclude,
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(task);
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ error: 'Failed to fetch task' });
  }
};

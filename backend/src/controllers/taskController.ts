import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { isString } from '../middleware/validation';
import { isRecordNotFoundError, prisma } from '../db/prisma';
import {
  findTaskIdForUser,
  findTaskIdsByFullTextSearch,
  taskDetailInclude,
  taskListInclude,
} from '../db/taskQueries';
import { idSelect } from '../db/selects';
import { publishTaskChanged, publishTaskListChanged } from '../realtime/taskEvents';

export const getTasks = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const search = isString(req.query.search) ? req.query.search.trim() : undefined;
    const status = isString(req.query.status) ? req.query.status : undefined;
    const priority = isString(req.query.priority) ? req.query.priority : undefined;

    if (search) {
      const taskIds = await findTaskIdsByFullTextSearch(prisma, {
        userId,
        search,
        status,
        priority,
      });

      if (taskIds.length === 0) {
        return res.json([]);
      }

      const tasks = await prisma.task.findMany({
        where: {
          id: {
            in: taskIds,
          },
          assignments: {
            some: {
              userId,
            },
          },
          ...(status && { status }),
          ...(priority && { priority }),
        },
        include: taskListInclude,
      });

      const tasksById = new Map(tasks.map((task) => [task.id, task]));
      const orderedTasks = taskIds.flatMap((taskId) => {
        const task = tasksById.get(taskId);
        return task ? [task] : [];
      });

      return res.json(orderedTasks);
    }

    const tasks = await prisma.task.findMany({
      where: {
        assignments: {
          some: {
            userId,
          },
        },
        ...(status && { status }),
        ...(priority && { priority }),
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
        assignments: {
          create: {
            userId,
          },
        },
      },
      include: taskListInclude,
    });

    publishTaskListChanged({ userIds: [userId], actorUserId: userId });
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

    const updated = await prisma.task.updateMany({
      where: {
        id,
        assignments: {
          some: {
            userId,
          },
        },
      },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(status && { status }),
        ...(priority && { priority }),
      },
    });

    if (updated.count === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = await prisma.task.findUnique({
      where: {
        id,
      },
      include: taskListInclude,
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    publishTaskChanged({ taskId: task.id, action: 'updated', actorUserId: userId });
    res.json(task);
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return res.status(404).json({ error: 'Task not found' });
    }

    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
};

export const updateTaskAssignments = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const { userIds } = req.body as { userIds: string[] };

    const task = await findTaskIdForUser(prisma, userId, id);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (userIds.length > 0) {
      const users = await prisma.user.findMany({
        where: {
          id: {
            in: userIds,
          },
        },
        select: idSelect,
      });

      if (users.length !== userIds.length) {
        return res.status(400).json({ error: 'One or more assignees do not exist' });
      }
    }

    const previousAssignments = await prisma.taskAssignment.findMany({
      where: {
        taskId: id,
      },
      select: {
        userId: true,
      },
    });

    const updatedTask = await prisma.$transaction(async (tx) => {
      await tx.taskAssignment.deleteMany({
        where: {
          taskId: id,
        },
      });

      if (userIds.length > 0) {
        await tx.taskAssignment.createMany({
          data: userIds.map((assigneeUserId) => ({
            taskId: id,
            userId: assigneeUserId,
          })),
        });
      }

      return tx.task.findUnique({
        where: {
          id,
        },
        include: taskDetailInclude,
      });
    });

    if (!updatedTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    publishTaskChanged({ taskId: updatedTask.id, action: 'assignments_updated', actorUserId: userId });
    publishTaskListChanged({
      userIds: uniqueUserIds([...previousAssignments.map((assignment) => assignment.userId), ...userIds]),
      actorUserId: userId,
    });
    res.json(updatedTask);
  } catch (error) {
    console.error('Error updating task assignments:', error);
    res.status(500).json({ error: 'Failed to update task assignments' });
  }
};

export const deleteTask = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const deletedAssignmentUserIds = await prisma.$transaction(async (tx) => {
      const task = await findTaskIdForUser(tx, userId, id);

      if (!task) {
        return null;
      }

      const assignments = await tx.taskAssignment.findMany({
        where: {
          taskId: id,
        },
        select: {
          userId: true,
        },
      });

      await tx.task.delete({ where: { id } });
      return assignments.map((assignment) => assignment.userId);
    });

    if (!deletedAssignmentUserIds) {
      return res.status(404).json({ error: 'Task not found' });
    }

    publishTaskChanged({ taskId: id, action: 'deleted', actorUserId: userId });
    publishTaskListChanged({ userIds: deletedAssignmentUserIds, actorUserId: userId });
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

    const task = await prisma.task.findFirst({
      where: {
        id,
        assignments: {
          some: {
            userId,
          },
        },
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

const uniqueUserIds = (userIds: string[]) => [...new Set(userIds)];

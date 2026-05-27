import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../db/prisma';
import {
  commentWithUserInclude,
  findCommentForAuthorOrTaskOwner,
  taskAssignedToUser,
  taskVisibleToUser,
} from '../db/taskQueries';

export const createComment = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { taskId, content } = req.body;

    if (!(await taskVisibleToUser(prisma, userId, taskId))) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (!(await taskAssignedToUser(prisma, userId, taskId))) {
      return res.status(403).json({ error: 'Only assigned users can comment on this task' });
    }

    const comment = await prisma.comment.create({
      data: {
        content,
        taskId,
        userId,
      },
      include: commentWithUserInclude,
    });

    res.status(201).json(comment);
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({ error: 'Failed to create comment' });
  }
};

export const getComments = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { taskId } = req.query;

    const taskIdString = taskId as string;

    if (!(await taskVisibleToUser(prisma, userId, taskIdString))) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const comments = await prisma.comment.findMany({
      where: {
        taskId: taskIdString,
      },
      include: commentWithUserInclude,
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json(comments);
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
};

export const deleteComment = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const comment = await findCommentForAuthorOrTaskOwner(prisma, userId, id);

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    await prisma.comment.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
};

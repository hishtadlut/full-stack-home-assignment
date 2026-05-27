import { Response } from 'express';
import { prisma } from '../db/prisma';
import { publicUserSelect } from '../db/selects';
import { AuthRequest } from '../middleware/auth';

export const listUsers = async (_req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: publicUserSelect,
      orderBy: {
        username: 'asc',
      },
    });

    res.json({ users });
  } catch (error) {
    console.error('Error listing users:', error);
    res.status(500).json({ error: 'Failed to list users' });
  }
};

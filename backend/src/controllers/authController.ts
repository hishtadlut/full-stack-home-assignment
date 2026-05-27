import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { AuthRequest } from '../middleware/auth';
import { LOGIN_RATE_LIMIT_ERROR } from '../constants/auth';
import { signAuthToken } from '../utils/jwt';
import { isUniqueConstraintError, prisma } from '../db/prisma';
import { publicUserSelect, toPublicUser } from '../db/selects';
import {
  clearLoginRateLimit,
  isLoginRateLimited,
  recordFailedLogin,
} from '../utils/loginRateLimit';

export const register = async (req: AuthRequest, res: Response) => {
  try {
    const { email, username, password, name } = req.body;

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { username },
        ],
      },
    });

    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        name,
      },
    });

    const token = signAuthToken(user.id);

    res.status(201).json({
      user: toPublicUser(user),
      token,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return res.status(409).json({ error: 'User already exists' });
    }

    console.error('Error registering user:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
};

export const login = async (req: AuthRequest, res: Response) => {
  try {
    const { email, password } = req.body;

    if (isLoginRateLimited(email)) {
      return res.status(429).json({ error: LOGIN_RATE_LIMIT_ERROR });
    }

    const user = await prisma.user.findFirst({
      where: { email },
    });

    if (!user) {
      recordFailedLogin(email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      recordFailedLogin(email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    clearLoginRateLimit(email);
    const token = signAuthToken(user.id);

    res.json({
      user: toPublicUser(user),
      token,
    });
  } catch (error) {
    console.error('Error logging in user:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
};

export const getMe = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: publicUserSelect,
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};

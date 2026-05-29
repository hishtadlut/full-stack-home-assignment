import { CookieOptions, Response } from 'express';
import bcrypt from 'bcryptjs';
import { AuthRequest } from '../middleware/auth';
import {
  LOGIN_RATE_LIMIT_ERROR,
  REFRESH_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_PATH,
  REFRESH_TOKEN_TTL_MS,
} from '../constants/auth';
import { signAuthToken } from '../utils/jwt';
import { isUniqueConstraintError, prisma } from '../db/prisma';
import { publicUserSelect, toPublicUser } from '../db/selects';
import {
  consumeRefreshTokenReuseWarningsForUser,
  recordRefreshTokenReuseEvent,
} from '../db/securityEvents';
import {
  createRefreshSession,
  RefreshTokenMetadata,
  revokeAllUserRefreshFamilies,
  revokeRefreshSession,
  rotateRefreshSession,
} from '../services/refreshTokens';
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
    await issueRefreshCookie(res, user.id, requestMetadata(req));

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
    const securityWarnings = await consumeRefreshTokenReuseWarningsForUser(user.id);
    await issueRefreshCookie(res, user.id, requestMetadata(req));

    res.json({
      user: toPublicUser(user),
      token,
      ...(securityWarnings.length > 0 && { securityWarnings }),
    });
  } catch (error) {
    console.error('Error logging in user:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
};

export const refresh = async (req: AuthRequest, res: Response) => {
  try {
    const refreshToken = readCookie(req, REFRESH_TOKEN_COOKIE_NAME);

    if (!refreshToken) {
      clearRefreshCookie(res);
      return res.status(401).json({ error: 'Refresh token required' });
    }

    const metadata = requestMetadata(req);
    const rotation = await rotateRefreshSession(refreshToken, metadata);

    if (rotation.status === 'reuse_detected') {
      await recordRefreshTokenReuseEvent({
        userId: rotation.userId,
        familyId: rotation.familyId,
        ...metadata,
      });
      clearRefreshCookie(res);
      return res.status(401).json({ error: 'Refresh token reuse detected. Please login again.' });
    }

    if (rotation.status !== 'rotated') {
      clearRefreshCookie(res);
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const user = await prisma.user.findUnique({
      where: { id: rotation.userId },
      select: publicUserSelect,
    });

    if (!user) {
      await revokeRefreshSession(refreshToken, metadata);
      clearRefreshCookie(res);
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    setRefreshCookie(res, rotation.token);

    res.json({
      user,
      token: signAuthToken(rotation.userId),
    });
  } catch (error) {
    console.error('Error refreshing token:', error);
    clearRefreshCookie(res);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
};

export const logout = async (req: AuthRequest, res: Response) => {
  try {
    await revokeRefreshSession(readCookie(req, REFRESH_TOKEN_COOKIE_NAME), requestMetadata(req));
    clearRefreshCookie(res);
    res.status(204).send();
  } catch (error) {
    console.error('Error logging out:', error);
    clearRefreshCookie(res);
    res.status(500).json({ error: 'Failed to logout' });
  }
};

export const logoutAllDevices = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    await revokeAllUserRefreshFamilies(req.userId, requestMetadata(req));
    clearRefreshCookie(res);
    res.status(204).send();
  } catch (error) {
    console.error('Error logging out all devices:', error);
    res.status(500).json({ error: 'Failed to logout all devices' });
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

const issueRefreshCookie = async (
  res: Response,
  userId: string,
  metadata: RefreshTokenMetadata,
) => {
  const refreshSession = await createRefreshSession(userId, metadata);
  setRefreshCookie(res, refreshSession.token);
};

const refreshCookieOptions: CookieOptions = {
  httpOnly: true,
  maxAge: REFRESH_TOKEN_TTL_MS,
  path: REFRESH_TOKEN_PATH,
  sameSite: 'lax',
  secure: true,
};

const setRefreshCookie = (res: Response, token: string) => {
  res.cookie(REFRESH_TOKEN_COOKIE_NAME, token, refreshCookieOptions);
};

const clearRefreshCookie = (res: Response) => {
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
    httpOnly: true,
    path: REFRESH_TOKEN_PATH,
    sameSite: 'lax',
    secure: true,
  });
};

const readCookie = (req: AuthRequest, name: string): string | undefined => {
  const cookieHeader = req.get('Cookie');

  if (!cookieHeader) {
    return undefined;
  }

  const cookies = cookieHeader.split(';').map((cookie) => cookie.trim());
  const prefix = `${name}=`;
  const cookie = cookies.find((value) => value.startsWith(prefix));

  if (!cookie) {
    return undefined;
  }

  try {
    return decodeURIComponent(cookie.slice(prefix.length));
  } catch {
    return cookie.slice(prefix.length);
  }
};

const requestMetadata = (req: AuthRequest): RefreshTokenMetadata => ({
  ip: firstForwardedIp(req.get('X-Forwarded-For')) ?? req.ip ?? null,
  userAgent: req.get('User-Agent') ?? null,
  approxLocation: requestApproxLocation(req),
});

const firstForwardedIp = (forwardedFor: string | undefined) =>
  forwardedFor?.split(',')[0]?.trim() || undefined;

const requestApproxLocation = (req: AuthRequest) => {
  const locationParts = [
    req.get('X-Geo-City'),
    req.get('X-Geo-Region'),
    req.get('X-Geo-Country'),
  ].filter((value): value is string => Boolean(value));

  return locationParts.length > 0 ? locationParts.join(', ') : null;
};

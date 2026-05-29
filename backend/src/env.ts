import { randomBytes } from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const placeholderJwtSecrets = new Set([
  'your-secret-key-change-in-production',
]);

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

const parseCorsOrigins = (): string[] => {
  return (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map(normalizeOrigin)
    .filter((origin): origin is string => Boolean(origin));
};

const normalizeOrigin = (value: string): string | null => {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  try {
    return new URL(trimmed).origin;
  } catch {
    return trimmed.replace(/\/+$/, '');
  }
};

const createDevelopmentJwtSecret = (): string => {
  return randomBytes(32).toString('hex');
};

const getJwtSecret = (): string => {
  const value = process.env.JWT_SECRET?.trim() ?? '';

  if (value && !placeholderJwtSecrets.has(value)) {
    return value;
  }

  const isMissing = !value;
  const productionError = isMissing
    ? 'JWT_SECRET is required'
    : 'JWT_SECRET must be changed from the default placeholder value';
  const developmentWarning = isMissing
    ? 'JWT_SECRET is not set'
    : 'JWT_SECRET uses a default placeholder value';

  if (isProduction) {
    throw new Error(productionError);
  } else {
    console.warn(`${developmentWarning}; using an ephemeral development JWT secret`);
  }

  return createDevelopmentJwtSecret();
};

const getRedisUrl = (): string | undefined => {
  const redisUrl = process.env.REDIS_URL?.trim() ?? '';

  if (redisUrl) {
    return redisUrl;
  }

  if (isProduction) {
    throw new Error('REDIS_URL is required');
  }

  return 'redis://localhost:6379';
};

export const env = {
  corsOrigins: parseCorsOrigins(),
  isProduction,
  jwtSecret: getJwtSecret(),
  nodeEnv,
  port: process.env.PORT || 3000,
  redisUrl: getRedisUrl(),
} as const;

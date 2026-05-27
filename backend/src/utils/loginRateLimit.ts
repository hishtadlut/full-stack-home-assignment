import {
  LOGIN_RATE_LIMIT_MAX_FAILED_ATTEMPTS,
  LOGIN_RATE_LIMIT_WINDOW_MS,
} from '../constants/auth';

type AttemptBucket = {
  count: number;
  resetAt: number;
};

const failedLoginAttempts = new Map<string, AttemptBucket>();

export const isLoginRateLimited = (email: string) => {
  const bucket = failedLoginAttempts.get(email);

  if (!bucket) {
    return false;
  }

  if (bucket.resetAt <= Date.now()) {
    failedLoginAttempts.delete(email);
    return false;
  }

  return bucket.count >= LOGIN_RATE_LIMIT_MAX_FAILED_ATTEMPTS;
};

export const recordFailedLogin = (email: string) => {
  const now = Date.now();
  const bucket = failedLoginAttempts.get(email);

  if (!bucket || bucket.resetAt <= now) {
    failedLoginAttempts.set(email, {
      count: 1,
      resetAt: now + LOGIN_RATE_LIMIT_WINDOW_MS,
    });
    return;
  }

  bucket.count += 1;
};

export const clearLoginRateLimit = (email: string) => {
  failedLoginAttempts.delete(email);
};

export const resetLoginRateLimits = () => {
  failedLoginAttempts.clear();
};

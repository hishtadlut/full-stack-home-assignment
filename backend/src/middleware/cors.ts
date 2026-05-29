import cors from 'cors';
import { env } from '../env';

const localDevOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

const configuredOrigins = new Set(env.corsOrigins);

export const corsMiddleware = cors({
  allowedHeaders: ['Authorization', 'Content-Type'],
  credentials: true,
  maxAge: 86400,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  optionsSuccessStatus: 204,
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (isTrustedBrowserOrigin(origin)) {
      callback(null, origin);
      return;
    }

    callback(null, false);
  },
});

export const isTrustedBrowserOrigin = (origin: string) =>
  configuredOrigins.has(origin) || isAllowedLocalDevOrigin(origin);

const isAllowedLocalDevOrigin = (origin: string) =>
  !env.isProduction && localDevOriginPattern.test(origin);

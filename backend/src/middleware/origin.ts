import { NextFunction, Request, Response } from 'express';
import { isTrustedBrowserOrigin } from './cors';

const unsafeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export const requireTrustedOriginForUnsafeRequests = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (!unsafeMethods.has(req.method)) {
    next();
    return;
  }

  const origin = req.get('Origin');

  if (!origin || isTrustedBrowserOrigin(origin)) {
    next();
    return;
  }

  res.status(403).json({ error: 'Untrusted request origin' });
};

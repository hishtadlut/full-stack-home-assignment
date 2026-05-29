import { REFRESH_TOKEN_REUSE_EVENT } from '../constants/auth';
import { prisma } from './prisma';

export interface SecurityEventMetadata {
  userId: string;
  familyId: string;
  ip?: string | null;
  userAgent?: string | null;
  approxLocation?: string | null;
}

export interface SecurityWarning {
  eventType: typeof REFRESH_TOKEN_REUSE_EVENT;
  time: string;
  ip: string | null;
  userAgent: string | null;
  approxLocation: string | null;
}

export const recordRefreshTokenReuseEvent = async ({
  userId,
  familyId,
  ip,
  userAgent,
  approxLocation,
}: SecurityEventMetadata) => {
  await prisma.securityEvent.create({
    data: {
      userId,
      familyId,
      eventType: REFRESH_TOKEN_REUSE_EVENT,
      ip: ip ?? null,
      userAgent: userAgent ?? null,
      approxLocation: approxLocation ?? null,
    },
  });
};

export const consumeRefreshTokenReuseWarningsForUser = async (
  userId: string,
): Promise<SecurityWarning[]> => {
  const events = await prisma.securityEvent.findMany({
    where: {
      userId,
      eventType: REFRESH_TOKEN_REUSE_EVENT,
      acknowledgedAt: null,
    },
    orderBy: {
      time: 'desc',
    },
    take: 5,
  });

  if (events.length === 0) {
    return [];
  }

  await prisma.securityEvent.updateMany({
    where: {
      id: {
        in: events.map((event) => event.id),
      },
    },
    data: {
      acknowledgedAt: new Date(),
    },
  });

  return events.map((event) => ({
    eventType: REFRESH_TOKEN_REUSE_EVENT,
    time: event.time.toISOString(),
    ip: event.ip,
    userAgent: event.userAgent,
    approxLocation: event.approxLocation,
  }));
};

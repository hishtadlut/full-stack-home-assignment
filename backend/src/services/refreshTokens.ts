import {
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'crypto';
import { createClient } from 'redis';
import {
  REFRESH_TOKEN_TTL_SECONDS,
} from '../constants/auth';
import { env } from '../env';

export interface RefreshTokenMetadata {
  ip?: string | null;
  userAgent?: string | null;
  approxLocation?: string | null;
}

interface RefreshTokenParts {
  familyId: string;
  rtId: string;
  secret: string;
  signature: string;
  hash: string;
}

export interface CreatedRefreshSession {
  token: string;
  familyId: string;
  rtId: string;
  expiresAt: Date;
}

export type RefreshRotationResult =
  | {
    status: 'rotated';
    userId: string;
    familyId: string;
    token: string;
    rtId: string;
    expiresAt: Date;
  }
  | {
    status: 'reuse_detected';
    userId: string;
    familyId: string;
  }
  | {
    status: 'invalid' | 'revoked' | 'missing' | 'mismatch';
    userId?: string;
    familyId?: string;
  };

type RefreshRotationFailureStatus = 'invalid' | 'revoked' | 'missing' | 'mismatch';

let redisClient: ReturnType<typeof createClient> | null = null;
let redisConnectPromise: Promise<ReturnType<typeof createClient>> | null = null;

const ROTATE_REFRESH_TOKEN_SCRIPT = `
local familyStatus = redis.call('HGET', KEYS[1], 'status')
if not familyStatus then
  return {'missing', '', ARGV[12]}
end

local familyUserId = redis.call('HGET', KEYS[1], 'userId') or ''
if familyStatus ~= 'active' then
  return {'revoked', familyUserId, ARGV[12]}
end

local currentRtId = redis.call('HGET', KEYS[1], 'currentRtId')
local currentHash = redis.call('HGET', KEYS[1], 'currentHash')
local presentedStatus = redis.call('HGET', KEYS[2], 'status')
local presentedHash = redis.call('HGET', KEYS[2], 'hash')

local function revoke_family_for_reuse()
  redis.call(
    'HSET',
    KEYS[1],
    'status', 'revoked',
    'revokedAt', ARGV[1],
    'revokedReason', 'reuse_detected',
    'reuseRtId', ARGV[3],
    'reuseIp', ARGV[8],
    'reuseUserAgent', ARGV[9],
    'updatedAt', ARGV[1]
  )

  if currentRtId then
    local currentTokenKey = ARGV[11] .. currentRtId
    redis.call(
      'HSET',
      currentTokenKey,
      'status', 'revoked',
      'revokedAt', ARGV[1],
      'revokedReason', 'reuse_detected'
    )
    redis.call('EXPIRE', currentTokenKey, tonumber(ARGV[2]))
  end

  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
  redis.call('EXPIRE', KEYS[2], tonumber(ARGV[2]))
  return {'reuse_detected', familyUserId, ARGV[12]}
end

if currentRtId ~= ARGV[3] or currentHash ~= ARGV[4] then
  if presentedStatus == 'used' and presentedHash == ARGV[4] then
    return revoke_family_for_reuse()
  end

  return {'mismatch', familyUserId, ARGV[12]}
end

if presentedStatus ~= 'active' or presentedHash ~= ARGV[4] then
  if presentedStatus == 'used' and presentedHash == ARGV[4] then
    return revoke_family_for_reuse()
  end

  return {'mismatch', familyUserId, ARGV[12]}
end

redis.call(
  'HSET',
  KEYS[2],
  'status', 'used',
  'usedAt', ARGV[1],
  'updatedAt', ARGV[1]
)

redis.call(
  'HSET',
  KEYS[3],
  'userId', familyUserId,
  'familyId', ARGV[12],
  'rtId', ARGV[5],
  'hash', ARGV[6],
  'status', 'active',
  'createdAt', ARGV[1],
  'updatedAt', ARGV[1],
  'expiresAt', ARGV[7],
  'ip', ARGV[8],
  'userAgent', ARGV[9],
  'approxLocation', ARGV[10]
)

redis.call(
  'HSET',
  KEYS[1],
  'currentRtId', ARGV[5],
  'currentHash', ARGV[6],
  'expiresAt', ARGV[7],
  'updatedAt', ARGV[1],
  'currentIp', ARGV[8],
  'currentUserAgent', ARGV[9],
  'currentApproxLocation', ARGV[10]
)

local userFamiliesKey = ARGV[13] .. familyUserId .. ':families'
redis.call('SADD', userFamiliesKey, ARGV[12])
redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
redis.call('EXPIRE', KEYS[2], tonumber(ARGV[2]))
redis.call('EXPIRE', KEYS[3], tonumber(ARGV[2]))
redis.call('EXPIRE', userFamiliesKey, tonumber(ARGV[2]))

return {'rotated', familyUserId, ARGV[12]}
`;

export const createRefreshSession = async (
  userId: string,
  metadata: RefreshTokenMetadata,
): Promise<CreatedRefreshSession> => {
  const client = await getRedisClient();
  const familyId = randomUUID();
  const token = createRefreshToken(familyId);
  const now = new Date();
  const expiresAt = expiresFrom(now);

  await client.multi()
    .hSet(refreshFamilyKey(familyId), refreshFamilyFields({
      userId,
      familyId,
      rtId: token.rtId,
      hash: token.hash,
      status: 'active',
      now,
      expiresAt,
      metadata,
    }))
    .expire(refreshFamilyKey(familyId), REFRESH_TOKEN_TTL_SECONDS)
    .hSet(refreshTokenKey(familyId, token.rtId), refreshTokenFields({
      userId,
      familyId,
      rtId: token.rtId,
      hash: token.hash,
      status: 'active',
      now,
      expiresAt,
      metadata,
    }))
    .expire(refreshTokenKey(familyId, token.rtId), REFRESH_TOKEN_TTL_SECONDS)
    .sAdd(userFamiliesKey(userId), familyId)
    .expire(userFamiliesKey(userId), REFRESH_TOKEN_TTL_SECONDS)
    .exec();

  return {
    token: token.raw,
    familyId,
    rtId: token.rtId,
    expiresAt,
  };
};

export const rotateRefreshSession = async (
  rawToken: string,
  metadata: RefreshTokenMetadata,
): Promise<RefreshRotationResult> => {
  const presented = parseRefreshToken(rawToken);

  if (!presented) {
    return { status: 'invalid' };
  }

  const client = await getRedisClient();
  const nextToken = createRefreshToken(presented.familyId);
  const now = new Date();
  const expiresAt = expiresFrom(now);
  const result = await client.eval(ROTATE_REFRESH_TOKEN_SCRIPT, {
    keys: [
      refreshFamilyKey(presented.familyId),
      refreshTokenKey(presented.familyId, presented.rtId),
      refreshTokenKey(presented.familyId, nextToken.rtId),
    ],
    arguments: [
      now.toISOString(),
      String(REFRESH_TOKEN_TTL_SECONDS),
      presented.rtId,
      presented.hash,
      nextToken.rtId,
      nextToken.hash,
      expiresAt.toISOString(),
      normalizeMetadataValue(metadata.ip),
      normalizeMetadataValue(metadata.userAgent),
      normalizeMetadataValue(metadata.approxLocation),
      refreshTokenKeyPrefix(presented.familyId),
      presented.familyId,
      userFamiliesKeyPrefix(),
    ],
  }) as string[];

  const [status, userId, familyId] = result;

  if (status === 'rotated') {
    return {
      status,
      userId,
      familyId,
      token: nextToken.raw,
      rtId: nextToken.rtId,
      expiresAt,
    };
  }

  if (status === 'reuse_detected') {
    return { status, userId, familyId };
  }

  return {
    status: toRefreshRotationFailureStatus(status),
    userId: userId || undefined,
    familyId: familyId || presented.familyId,
  };
};

export const revokeRefreshSession = async (
  rawToken: string | undefined,
  metadata: RefreshTokenMetadata,
) => {
  if (!rawToken) {
    return;
  }

  const parsed = parseRefreshToken(rawToken);

  if (!parsed) {
    return;
  }

  const client = await getRedisClient();
  const now = new Date().toISOString();

  await client.multi()
    .hSet(refreshFamilyKey(parsed.familyId), {
      status: 'revoked',
      revokedAt: now,
      revokedReason: 'logout',
      revokeIp: normalizeMetadataValue(metadata.ip),
      revokeUserAgent: normalizeMetadataValue(metadata.userAgent),
      updatedAt: now,
    })
    .expire(refreshFamilyKey(parsed.familyId), REFRESH_TOKEN_TTL_SECONDS)
    .hSet(refreshTokenKey(parsed.familyId, parsed.rtId), {
      status: 'revoked',
      revokedAt: now,
      revokedReason: 'logout',
    })
    .expire(refreshTokenKey(parsed.familyId, parsed.rtId), REFRESH_TOKEN_TTL_SECONDS)
    .exec();
};

export const revokeAllUserRefreshFamilies = async (
  userId: string,
  metadata: RefreshTokenMetadata,
) => {
  const client = await getRedisClient();
  const familyIds = await client.sMembers(userFamiliesKey(userId));

  if (familyIds.length === 0) {
    return;
  }

  const now = new Date().toISOString();
  const transaction = client.multi();

  familyIds.forEach((familyId) => {
    transaction
      .hSet(refreshFamilyKey(familyId), {
        status: 'revoked',
        revokedAt: now,
        revokedReason: 'logout_all_devices',
        revokeIp: normalizeMetadataValue(metadata.ip),
        revokeUserAgent: normalizeMetadataValue(metadata.userAgent),
        updatedAt: now,
      })
      .expire(refreshFamilyKey(familyId), REFRESH_TOKEN_TTL_SECONDS);
  });

  await transaction.exec();
};

const getRedisClient = async () => {
  if (!env.redisUrl) {
    throw new Error('REDIS_URL is required');
  }

  if (redisClient?.isOpen) {
    return redisClient;
  }

  if (redisConnectPromise) {
    return redisConnectPromise;
  }

  const client = createClient({ url: env.redisUrl });
  client.on('error', (error) => {
    console.error('Redis client error:', error);
  });
  redisClient = client;
  redisConnectPromise = client.connect().then(
    () => client,
    (error) => {
      redisClient = null;
      throw error;
    },
  ).finally(() => {
    redisConnectPromise = null;
  });

  return redisConnectPromise;
};

const createRefreshToken = (familyId: string) => {
  const rtId = randomUUID();
  const secret = randomBytes(32).toString('base64url');
  const signature = signRefreshToken(familyId, rtId, secret);
  const hash = hashRefreshSecret(secret, signature);

  return {
    raw: `${familyId}.${rtId}.${secret}.${signature}`,
    rtId,
    hash,
  };
};

const parseRefreshToken = (rawToken: string): RefreshTokenParts | null => {
  const parts = rawToken.split('.');

  if (parts.length !== 4) {
    return null;
  }

  const [familyId, rtId, secret, signature] = parts;

  if (!familyId || !rtId || !secret || !signature) {
    return null;
  }

  const expectedSignature = signRefreshToken(familyId, rtId, secret);

  if (!constantTimeEqual(signature, expectedSignature)) {
    return null;
  }

  return {
    familyId,
    rtId,
    secret,
    signature,
    hash: hashRefreshSecret(secret, signature),
  };
};

const signRefreshToken = (familyId: string, rtId: string, secret: string) =>
  createHmac('sha256', env.jwtSecret)
    .update(`refresh-token:${familyId}:${rtId}:${secret}`)
    .digest('base64url');

const hashRefreshSecret = (secret: string, signature: string) =>
  createHmac('sha256', env.jwtSecret)
    .update(`${secret}.${signature}`)
    .digest('base64url');

const constantTimeEqual = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};

const expiresFrom = (date: Date) =>
  new Date(date.getTime() + REFRESH_TOKEN_TTL_SECONDS * 1000);

const refreshFamilyFields = (input: {
  userId: string;
  familyId: string;
  rtId: string;
  hash: string;
  status: 'active' | 'used' | 'revoked';
  now: Date;
  expiresAt: Date;
  metadata: RefreshTokenMetadata;
}) => ({
  userId: input.userId,
  familyId: input.familyId,
  status: input.status,
  currentRtId: input.rtId,
  currentHash: input.hash,
  createdAt: input.now.toISOString(),
  updatedAt: input.now.toISOString(),
  expiresAt: input.expiresAt.toISOString(),
  currentIp: normalizeMetadataValue(input.metadata.ip),
  currentUserAgent: normalizeMetadataValue(input.metadata.userAgent),
  currentApproxLocation: normalizeMetadataValue(input.metadata.approxLocation),
});

const refreshTokenFields = (input: {
  userId: string;
  familyId: string;
  rtId: string;
  hash: string;
  status: 'active' | 'used' | 'revoked';
  now: Date;
  expiresAt: Date;
  metadata: RefreshTokenMetadata;
}) => ({
  userId: input.userId,
  familyId: input.familyId,
  rtId: input.rtId,
  hash: input.hash,
  status: input.status,
  createdAt: input.now.toISOString(),
  updatedAt: input.now.toISOString(),
  expiresAt: input.expiresAt.toISOString(),
  ip: normalizeMetadataValue(input.metadata.ip),
  userAgent: normalizeMetadataValue(input.metadata.userAgent),
  approxLocation: normalizeMetadataValue(input.metadata.approxLocation),
});

const normalizeMetadataValue = (value: string | null | undefined) => value ?? '';

const toRefreshRotationFailureStatus = (status: string): RefreshRotationFailureStatus => {
  if (status === 'revoked' || status === 'missing' || status === 'mismatch') {
    return status;
  }

  return 'invalid';
};

const refreshFamilyKey = (familyId: string) => `rf:family:${familyId}`;
const refreshTokenKeyPrefix = (familyId: string) => `${refreshFamilyKey(familyId)}:rt:`;
const refreshTokenKey = (familyId: string, rtId: string) => `${refreshTokenKeyPrefix(familyId)}${rtId}`;
const userFamiliesKeyPrefix = () => 'rf:user:';
const userFamiliesKey = (userId: string) => `rf:user:${userId}:families`;

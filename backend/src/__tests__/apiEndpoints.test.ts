import jwt from 'jsonwebtoken';
import request from 'supertest';
import type { Express } from 'express';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { LOGIN_RATE_LIMIT_ERROR } from '../constants/auth';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'endpoint-test-secret';

const mocks = vi.hoisted(() => {
  class PrismaClientKnownRequestError extends Error {
    code: string;
    clientVersion: string;
    meta?: unknown;

    constructor(message: string, options: { code: string; clientVersion?: string; meta?: unknown }) {
      super(message);
      this.name = 'PrismaClientKnownRequestError';
      this.code = options.code;
      this.clientVersion = options.clientVersion ?? 'test';
      this.meta = options.meta;
    }
  }

  class DraftExecutionError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'DraftExecutionError';
    }
  }

  const prisma = {
    user: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    task: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    comment: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
      delete: vi.fn(),
    },
    taskAssignment: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    taskTag: {
      deleteMany: vi.fn(),
    },
    assistantChat: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    assistantMessage: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    assistantDraft: {
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  };

  return {
    PrismaClientKnownRequestError,
    DraftExecutionError,
    bcryptCompare: vi.fn(),
    bcryptHash: vi.fn(),
    executeApprovedDraft: vi.fn(),
    generateAssistantResponse: vi.fn(),
    prisma,
  };
});

vi.mock('@prisma/client', async () => {
  const actual = await vi.importActual<typeof import('@prisma/client')>('@prisma/client');

  return {
    ...actual,
    Prisma: {
      ...actual.Prisma,
      PrismaClientKnownRequestError: mocks.PrismaClientKnownRequestError,
    },
    PrismaClient: vi.fn(function PrismaClient() {
      return mocks.prisma;
    }),
  };
});

vi.mock('../db/prisma', () => ({
  prisma: mocks.prisma,
  isRecordNotFoundError: (error: unknown) => error instanceof mocks.PrismaClientKnownRequestError && error.code === 'P2025',
  isForeignKeyConstraintError: (error: unknown) => error instanceof mocks.PrismaClientKnownRequestError && error.code === 'P2003',
  isUniqueConstraintError: (error: unknown) => error instanceof mocks.PrismaClientKnownRequestError && error.code === 'P2002',
}));

vi.mock('bcryptjs', () => ({
  default: {
    compare: mocks.bcryptCompare,
    hash: mocks.bcryptHash,
  },
  compare: mocks.bcryptCompare,
  hash: mocks.bcryptHash,
}));

vi.mock('../assistant/geminiAssistant', () => ({
  generateAssistantResponse: mocks.generateAssistantResponse,
}));

vi.mock('../assistant/executor', () => ({
  DraftExecutionError: mocks.DraftExecutionError,
  executeApprovedDraft: mocks.executeApprovedDraft,
}));

const now = new Date('2026-05-27T10:00:00.000Z');

const user = {
  id: 'user-1',
  email: 'user@example.com',
  username: 'user',
  name: 'Test User',
};

const task = {
  id: 'task-1',
  title: 'Write tests',
  description: null,
  status: 'TODO',
  priority: 'MEDIUM',
  userId: user.id,
  createdAt: now,
  updatedAt: now,
};

const secondTask = {
  ...task,
  id: 'task-2',
  title: 'Write integration tests',
};

const comment = {
  id: 'comment-1',
  content: 'Looks good',
  taskId: task.id,
  userId: user.id,
  createdAt: now,
  updatedAt: now,
  user,
};

const chat = {
  id: 'chat-1',
  userId: user.id,
  title: 'New chat',
};

const chatSnapshot = {
  id: chat.id,
  title: 'New chat',
  summary: null,
  lastMessagePreview: 'Hello',
  messageCount: 2,
  createdAt: now,
  updatedAt: now,
  lastMessageAt: now,
  messages: [],
};

const validDraft = {
  schemaVersion: 1,
  summary: 'Create a task',
  operations: [
    {
      id: 'op-1',
      type: 'create_task',
      label: 'Create task',
      input: {
        title: 'Drafted task',
        status: 'TODO',
        priority: 'HIGH',
      },
    },
  ],
};

const successfulExecution = {
  ok: true,
  operations: [
    {
      operationId: 'op-1',
      type: 'create_task',
      ok: true,
      entityId: task.id,
    },
  ],
};

let app: Express;
let resetLoginRateLimits: () => void;

beforeAll(async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  resetLoginRateLimits = (await import('../utils/loginRateLimit.js')).resetLoginRateLimits;
  app = (await import('../app.js')).app;
});

beforeEach(() => {
  resetMockTree(mocks);
  resetLoginRateLimits();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});

  mocks.prisma.$transaction.mockImplementation(async (operation: unknown) => {
    if (typeof operation === 'function') {
      return operation(mocks.prisma);
    }

    return Promise.all(operation as Array<Promise<unknown>>);
  });

  mocks.bcryptHash.mockResolvedValue('hashed-password');
  mocks.bcryptCompare.mockResolvedValue(true);
  mocks.executeApprovedDraft.mockResolvedValue(successfulExecution);
  mocks.generateAssistantResponse.mockResolvedValue({
    schemaVersion: 1,
    message: 'No draft needed',
    draft: null,
  });
  mocks.prisma.assistantChat.update.mockResolvedValue({ messageCount: 1 });
  mocks.prisma.assistantMessage.create.mockResolvedValue({ id: 'message-1' });
  mocks.prisma.assistantDraft.create.mockResolvedValue({ id: 'draft-1' });
  mocks.prisma.assistantDraft.findFirst.mockResolvedValue(null);
  mocks.prisma.assistantDraft.updateMany.mockResolvedValue({ count: 0 });
  mocks.prisma.assistantDraft.update.mockResolvedValue({ id: 'draft-1' });
  mocks.prisma.taskAssignment.findMany.mockResolvedValue([]);
  mocks.prisma.task.updateMany.mockResolvedValue({ count: 1 });
});

const resetMockTree = (value: unknown): void => {
  if (vi.isMockFunction(value)) {
    value.mockReset();
    return;
  }

  if (typeof value !== 'object' || value === null) {
    return;
  }

  Object.values(value).forEach(resetMockTree);
};

const authHeader = (userId = user.id) =>
  `Bearer ${jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '1h' })}`;

const expectError = (response: request.Response, status: number, error: string) => {
  expect(response.status).toBe(status);
  expect(response.body).toEqual({ error });
};

const recordNotFound = () =>
  new mocks.PrismaClientKnownRequestError('Record not found', {
    code: 'P2025',
  });

describe('app endpoints', () => {
  it('GET /health returns service status', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('POST /api/auth/login rejects malformed JSON bodies', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":');

    expectError(response, 400, 'Malformed JSON request body');
  });

  it('allows local frontend origins for development and tests', async () => {
    const response = await request(app)
      .get('/health')
      .set('Origin', 'http://localhost:5173');

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('does not emit CORS headers for untrusted origins', async () => {
    const response = await request(app)
      .get('/health')
      .set('Origin', 'https://evil.example');

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('auth endpoints', () => {
  it('POST /api/auth/register creates a user and token for a valid request', async () => {
    mocks.prisma.user.findFirst.mockResolvedValue(null);
    mocks.prisma.user.create.mockResolvedValue({
      ...user,
      password: 'hashed-password',
    });

    const response = await request(app).post('/api/auth/register').send({
      email: ' USER@example.com ',
      username: ' user ',
      password: 'password123',
      name: ' Test User ',
    });

    expect(response.status).toBe(201);
    expect(response.body.user).toEqual(user);
    expect(response.body.token).toEqual(expect.any(String));
    expect(mocks.bcryptHash).toHaveBeenCalledWith('password123', 10);
    expect(mocks.prisma.user.create).toHaveBeenCalledWith({
      data: {
        email: 'user@example.com',
        username: 'user',
        password: 'hashed-password',
        name: 'Test User',
      },
    });
  });

  it.each([
    ['POST /api/auth/register rejects array bodies', [], 'Request body must be a JSON object'],
    [
      'POST /api/auth/register rejects invalid emails',
      { email: 'bad-email', username: 'user', password: 'password123' },
      'A valid email is required',
    ],
    [
      'POST /api/auth/register rejects long usernames',
      { email: 'user@example.com', username: 'u'.repeat(81), password: 'password123' },
      'Username is required and must be 80 characters or fewer',
    ],
    [
      'POST /api/auth/register rejects missing passwords',
      { email: 'user@example.com', username: 'user' },
      'Password is required',
    ],
    [
      'POST /api/auth/register rejects short passwords',
      { email: 'user@example.com', username: 'user', password: 'short' },
      'Password must be between 8 and 128 characters',
    ],
    [
      'POST /api/auth/register rejects non-string names',
      { email: 'user@example.com', username: 'user', password: 'password123', name: 12 },
      'Name must be a string or null',
    ],
    [
      'POST /api/auth/register rejects long names',
      { email: 'user@example.com', username: 'user', password: 'password123', name: 'n'.repeat(121) },
      'Name must be 120 characters or fewer',
    ],
  ])('%s', async (_name, body, error) => {
    const response = await request(app).post('/api/auth/register').send(body);

    expectError(response, 400, error);
  });

  it('POST /api/auth/register reports duplicate users', async () => {
    mocks.prisma.user.findFirst.mockResolvedValue(user);

    const response = await request(app).post('/api/auth/register').send({
      email: user.email,
      username: user.username,
      password: 'password123',
    });

    expectError(response, 409, 'User already exists');
  });

  it('POST /api/auth/register reports duplicate users from unique constraint races', async () => {
    mocks.prisma.user.findFirst.mockResolvedValue(null);
    mocks.prisma.user.create.mockRejectedValue(new mocks.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
    }));

    const response = await request(app).post('/api/auth/register').send({
      email: user.email,
      username: user.username,
      password: 'password123',
    });

    expectError(response, 409, 'User already exists');
  });

  it('POST /api/auth/register reports unexpected persistence errors', async () => {
    mocks.prisma.user.findFirst.mockRejectedValue(new Error('database down'));

    const response = await request(app).post('/api/auth/register').send({
      email: user.email,
      username: user.username,
      password: 'password123',
    });

    expectError(response, 500, 'Failed to register user');
  });

  it('POST /api/auth/login returns a token for valid credentials', async () => {
    mocks.prisma.user.findFirst.mockResolvedValue({
      ...user,
      password: 'hashed-password',
    });
    mocks.bcryptCompare.mockResolvedValue(true);

    const response = await request(app).post('/api/auth/login').send({
      email: ' USER@example.com ',
      password: 'password123',
    });

    expect(response.status).toBe(200);
    expect(response.body.user).toEqual(user);
    expect(response.body.token).toEqual(expect.any(String));
    expect(mocks.bcryptCompare).toHaveBeenCalledWith('password123', 'hashed-password');
  });

  it.each([
    [
      'POST /api/auth/login rejects invalid emails',
      { email: 'bad-email', password: 'password123' },
      'A valid email is required',
    ],
    [
      'POST /api/auth/login rejects missing passwords',
      { email: user.email },
      'Password is required',
    ],
  ])('%s', async (_name, body, error) => {
    const response = await request(app).post('/api/auth/login').send(body);

    expectError(response, 400, error);
  });

  it('POST /api/auth/login rejects unknown users', async () => {
    mocks.prisma.user.findFirst.mockResolvedValue(null);

    const response = await request(app).post('/api/auth/login').send({
      email: user.email,
      password: 'password123',
    });

    expectError(response, 401, 'Invalid credentials');
  });

  it('POST /api/auth/login rejects invalid passwords', async () => {
    mocks.prisma.user.findFirst.mockResolvedValue({
      ...user,
      password: 'hashed-password',
    });
    mocks.bcryptCompare.mockResolvedValue(false);

    const response = await request(app).post('/api/auth/login').send({
      email: user.email,
      password: 'wrong-password',
    });

    expectError(response, 401, 'Invalid credentials');
  });

  it('POST /api/auth/login throttles repeated failed attempts', async () => {
    mocks.prisma.user.findFirst.mockResolvedValue({
      ...user,
      password: 'hashed-password',
    });
    mocks.bcryptCompare.mockResolvedValue(false);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const failedResponse = await request(app).post('/api/auth/login').send({
        email: user.email,
        password: 'wrong-password',
      });

      expectError(failedResponse, 401, 'Invalid credentials');
    }

    const throttledResponse = await request(app).post('/api/auth/login').send({
      email: user.email,
      password: 'wrong-password',
    });

    expectError(throttledResponse, 429, LOGIN_RATE_LIMIT_ERROR);
    expect(mocks.bcryptCompare).toHaveBeenCalledTimes(5);
  });

  it('POST /api/auth/login reports unexpected persistence errors', async () => {
    mocks.prisma.user.findFirst.mockRejectedValue(new Error('database down'));

    const response = await request(app).post('/api/auth/login').send({
      email: user.email,
      password: 'password123',
    });

    expectError(response, 500, 'Failed to login');
  });

  it('GET /api/auth/me returns the authenticated user', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(user);

    const response = await request(app).get('/api/auth/me').set('Authorization', authHeader());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ user });
  });

  it('GET /api/auth/me rejects missing tokens', async () => {
    const response = await request(app).get('/api/auth/me');

    expectError(response, 401, 'Authentication required');
  });

  it('GET /api/auth/me rejects invalid tokens', async () => {
    const response = await request(app).get('/api/auth/me').set('Authorization', 'Bearer invalid-token');

    expectError(response, 401, 'Invalid or expired token');
  });

  it('GET /api/auth/me reports missing users', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(null);

    const response = await request(app).get('/api/auth/me').set('Authorization', authHeader());

    expectError(response, 404, 'User not found');
  });

  it('GET /api/auth/me reports unexpected persistence errors', async () => {
    mocks.prisma.user.findUnique.mockRejectedValue(new Error('database down'));

    const response = await request(app).get('/api/auth/me').set('Authorization', authHeader());

    expectError(response, 500, 'Failed to fetch user');
  });
});

describe('user endpoints', () => {
  it('GET /api/users lists assignable users', async () => {
    mocks.prisma.user.findMany.mockResolvedValue([user]);

    const response = await request(app).get('/api/users').set('Authorization', authHeader());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ users: [user] });
    expect(mocks.prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.any(Object),
      orderBy: { username: 'asc' },
    }));
  });

  it('GET /api/users reports unexpected persistence errors', async () => {
    mocks.prisma.user.findMany.mockRejectedValue(new Error('database down'));

    const response = await request(app).get('/api/users').set('Authorization', authHeader());

    expectError(response, 500, 'Failed to list users');
  });
});

describe('task endpoints', () => {
  it('GET /api/tasks lists filtered tasks for the authenticated user', async () => {
    mocks.prisma.task.findMany.mockResolvedValue([task]);

    const response = await request(app)
      .get('/api/tasks')
      .query({ status: 'TODO', priority: 'MEDIUM' })
      .set('Authorization', authHeader());

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({ id: task.id, title: task.title });
    expect(mocks.prisma.task.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        assignments: {
          some: {
            userId: user.id,
          },
        },
        status: 'TODO',
        priority: 'MEDIUM',
      }),
    }));
    expect(mocks.prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('GET /api/tasks uses PostgreSQL full-text search for searched task lists', async () => {
    mocks.prisma.$queryRaw.mockResolvedValue([{ id: secondTask.id }, { id: task.id }]);
    mocks.prisma.task.findMany.mockResolvedValue([task, secondTask]);

    const response = await request(app)
      .get('/api/tasks')
      .query({ search: ' write tests ', status: 'TODO', priority: 'MEDIUM' })
      .set('Authorization', authHeader());

    expect(response.status).toBe(200);
    expect(response.body.map((item: { id: string }) => item.id)).toEqual([secondTask.id, task.id]);
    expect(mocks.prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.task.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: {
          in: [secondTask.id, task.id],
        },
        assignments: {
          some: {
            userId: user.id,
          },
        },
        status: 'TODO',
        priority: 'MEDIUM',
      }),
    }));
  });

  it('GET /api/tasks returns an empty list when full-text search finds no task ids', async () => {
    mocks.prisma.$queryRaw.mockResolvedValue([]);

    const response = await request(app)
      .get('/api/tasks')
      .query({ search: 'missing task' })
      .set('Authorization', authHeader());

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
    expect(mocks.prisma.task.findMany).not.toHaveBeenCalled();
  });

  it.each([
    ['GET /api/tasks rejects repeated search values', { search: ['a', 'b'] }, 'Search must be a single string'],
    ['GET /api/tasks rejects long search values', { search: 'a'.repeat(101) }, 'Search must be 100 characters or fewer'],
    ['GET /api/tasks rejects invalid statuses', { status: 'BLOCKED' }, 'Invalid task status'],
    ['GET /api/tasks rejects invalid priorities', { priority: 'URGENT' }, 'Invalid task priority'],
    ['GET /api/tasks rejects repeated priority values', { priority: ['LOW', 'HIGH'] }, 'Invalid task priority'],
  ])('%s', async (_name, query, error) => {
    const response = await request(app)
      .get('/api/tasks')
      .query(query)
      .set('Authorization', authHeader());

    expectError(response, 400, error);
  });

  it('GET /api/tasks rejects missing tokens', async () => {
    const response = await request(app).get('/api/tasks');

    expectError(response, 401, 'Authentication required');
  });

  it('GET /api/tasks reports unexpected persistence errors', async () => {
    mocks.prisma.task.findMany.mockRejectedValue(new Error('database down'));

    const response = await request(app).get('/api/tasks').set('Authorization', authHeader());

    expectError(response, 500, 'Failed to fetch tasks');
  });

  it('GET /api/tasks/:id returns a task with assignments and comments', async () => {
    mocks.prisma.task.findFirst.mockResolvedValue(task);

    const response = await request(app).get(`/api/tasks/${task.id}`).set('Authorization', authHeader());

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: task.id, title: task.title });
    expect(mocks.prisma.task.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: task.id,
        assignments: {
          some: {
            userId: user.id,
          },
        },
      },
    }));
  });

  it('GET /api/tasks/:id reports missing tasks', async () => {
    mocks.prisma.task.findFirst.mockResolvedValue(null);

    const response = await request(app).get('/api/tasks/missing').set('Authorization', authHeader());

    expectError(response, 404, 'Task not found');
  });

  it('GET /api/tasks/:id reports unexpected persistence errors', async () => {
    mocks.prisma.task.findFirst.mockRejectedValue(new Error('database down'));

    const response = await request(app).get(`/api/tasks/${task.id}`).set('Authorization', authHeader());

    expectError(response, 500, 'Failed to fetch task');
  });

  it('POST /api/tasks creates a task', async () => {
    mocks.prisma.task.create.mockResolvedValue(task);

    const response = await request(app)
      .post('/api/tasks')
      .set('Authorization', authHeader())
      .send({
        title: ' Write tests ',
        description: null,
        status: 'TODO',
        priority: 'MEDIUM',
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ id: task.id, title: task.title });
    expect(mocks.prisma.task.create).toHaveBeenCalledWith({
      data: {
        title: 'Write tests',
        description: null,
        status: 'TODO',
        priority: 'MEDIUM',
        userId: user.id,
        assignments: {
          create: {
            userId: user.id,
          },
        },
      },
      include: expect.any(Object),
    });
  });

  it.each([
    ['POST /api/tasks rejects array bodies', [], 'Request body must be a JSON object'],
    ['POST /api/tasks rejects missing titles', { description: 'No title' }, 'Title is required'],
    ['POST /api/tasks rejects non-string descriptions', { title: 'Task', description: 1 }, 'Description must be a string or null'],
    ['POST /api/tasks rejects invalid statuses', { title: 'Task', status: 'BLOCKED' }, 'Invalid task status'],
    ['POST /api/tasks rejects invalid priorities', { title: 'Task', priority: 'URGENT' }, 'Invalid task priority'],
  ])('%s', async (_name, body, error) => {
    const response = await request(app).post('/api/tasks').set('Authorization', authHeader()).send(body);

    expectError(response, 400, error);
  });

  it('POST /api/tasks reports unexpected persistence errors', async () => {
    mocks.prisma.task.create.mockRejectedValue(new Error('database down'));

    const response = await request(app)
      .post('/api/tasks')
      .set('Authorization', authHeader())
      .send({ title: 'Task' });

    expectError(response, 500, 'Failed to create task');
  });

  it('PATCH /api/tasks/:id updates a task', async () => {
    mocks.prisma.task.findUnique.mockResolvedValue({
      ...task,
      title: 'Updated',
      priority: 'HIGH',
    });

    const response = await request(app)
      .patch(`/api/tasks/${task.id}`)
      .set('Authorization', authHeader())
      .send({ title: ' Updated ', priority: 'HIGH' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ title: 'Updated', priority: 'HIGH' });
    expect(mocks.prisma.task.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: task.id,
        assignments: {
          some: {
            userId: user.id,
          },
        },
      },
      data: {
        title: 'Updated',
        priority: 'HIGH',
      },
    }));
  });

  it('PATCH /api/tasks/:id lets assigned non-owners edit a task', async () => {
    mocks.prisma.task.findUnique.mockResolvedValue({
      ...task,
      title: 'Assigned update',
    });

    const response = await request(app)
      .patch(`/api/tasks/${task.id}`)
      .set('Authorization', authHeader('assigned-user'))
      .send({ title: 'Assigned update' });

    expect(response.status).toBe(200);
    expect(mocks.prisma.task.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: task.id,
        assignments: {
          some: {
            userId: 'assigned-user',
          },
        },
      },
    }));
  });

  it.each([
    ['PATCH /api/tasks/:id rejects empty updates', {}, 'At least one task field must be provided'],
    ['PATCH /api/tasks/:id rejects blank titles', { title: ' ' }, 'Title is required'],
    ['PATCH /api/tasks/:id rejects non-string descriptions', { description: 1 }, 'Description must be a string or null'],
    ['PATCH /api/tasks/:id rejects invalid statuses', { status: 'BLOCKED' }, 'Invalid task status'],
    ['PATCH /api/tasks/:id rejects invalid priorities', { priority: 'URGENT' }, 'Invalid task priority'],
  ])('%s', async (_name, body, error) => {
    const response = await request(app)
      .patch(`/api/tasks/${task.id}`)
      .set('Authorization', authHeader())
      .send(body);

    expectError(response, 400, error);
  });

  it('PATCH /api/tasks/:id reports missing tasks', async () => {
    mocks.prisma.task.updateMany.mockResolvedValue({ count: 0 });

    const response = await request(app)
      .patch('/api/tasks/missing')
      .set('Authorization', authHeader())
      .send({ title: 'Updated' });

    expectError(response, 404, 'Task not found');
    expect(mocks.prisma.task.findUnique).not.toHaveBeenCalled();
  });

  it('PATCH /api/tasks/:id reports unexpected persistence errors', async () => {
    mocks.prisma.task.updateMany.mockRejectedValue(new Error('database down'));

    const response = await request(app)
      .patch(`/api/tasks/${task.id}`)
      .set('Authorization', authHeader())
      .send({ title: 'Updated' });

    expectError(response, 500, 'Failed to update task');
  });

  it('PATCH /api/tasks/:id/assignments replaces task assignees for the task owner', async () => {
    mocks.prisma.task.findFirst.mockResolvedValue({ id: task.id });
    mocks.prisma.user.findMany.mockResolvedValue([{ id: user.id }, { id: 'user-2' }]);
    mocks.prisma.task.findUnique.mockResolvedValue({
      ...task,
      assignments: [
        { id: 'assignment-1', taskId: task.id, userId: user.id },
        { id: 'assignment-2', taskId: task.id, userId: 'user-2' },
      ],
    });

    const response = await request(app)
      .patch(`/api/tasks/${task.id}/assignments`)
      .set('Authorization', authHeader())
      .send({ userIds: [user.id, 'user-2', user.id] });

    expect(response.status).toBe(200);
    expect(mocks.prisma.taskAssignment.deleteMany).toHaveBeenCalledWith({ where: { taskId: task.id } });
    expect(mocks.prisma.taskAssignment.createMany).toHaveBeenCalledWith({
      data: [
        { taskId: task.id, userId: user.id },
        { taskId: task.id, userId: 'user-2' },
      ],
    });
  });

  it('PATCH /api/tasks/:id/assignments rejects unknown assignees', async () => {
    mocks.prisma.task.findFirst.mockResolvedValue({ id: task.id });
    mocks.prisma.user.findMany.mockResolvedValue([{ id: user.id }]);

    const response = await request(app)
      .patch(`/api/tasks/${task.id}/assignments`)
      .set('Authorization', authHeader())
      .send({ userIds: [user.id, 'missing-user'] });

    expectError(response, 400, 'One or more assignees do not exist');
  });

  it('PATCH /api/tasks/:id/assignments clears assignees when the owner sends an empty list', async () => {
    mocks.prisma.task.findFirst.mockResolvedValue({ id: task.id });
    mocks.prisma.task.findUnique.mockResolvedValue({
      ...task,
      assignments: [],
    });

    const response = await request(app)
      .patch(`/api/tasks/${task.id}/assignments`)
      .set('Authorization', authHeader())
      .send({ userIds: [] });

    expect(response.status).toBe(200);
    expect(mocks.prisma.user.findMany).not.toHaveBeenCalled();
    expect(mocks.prisma.taskAssignment.deleteMany).toHaveBeenCalledWith({ where: { taskId: task.id } });
    expect(mocks.prisma.taskAssignment.createMany).not.toHaveBeenCalled();
  });

  it('PATCH /api/tasks/:id/assignments reports missing owned tasks', async () => {
    mocks.prisma.task.findFirst.mockResolvedValue(null);

    const response = await request(app)
      .patch('/api/tasks/missing/assignments')
      .set('Authorization', authHeader())
      .send({ userIds: [user.id] });

    expectError(response, 404, 'Task not found');
  });

  it('PATCH /api/tasks/:id/assignments reports persistence errors', async () => {
    mocks.prisma.task.findFirst.mockResolvedValue({ id: task.id });
    mocks.prisma.user.findMany.mockResolvedValue([{ id: user.id }]);
    mocks.prisma.taskAssignment.deleteMany.mockRejectedValue(new Error('database down'));

    const response = await request(app)
      .patch(`/api/tasks/${task.id}/assignments`)
      .set('Authorization', authHeader())
      .send({ userIds: [user.id] });

    expectError(response, 500, 'Failed to update task assignments');
  });

  it.each([
    ['PATCH /api/tasks/:id/assignments rejects missing arrays', {}, 'userIds must be an array'],
    ['PATCH /api/tasks/:id/assignments rejects invalid user ids', { userIds: [' '] }, 'Each assignee id must be a non-empty string'],
    [
      'PATCH /api/tasks/:id/assignments rejects too many assignees',
      { userIds: Array.from({ length: 21 }, (_value, index) => `user-${index}`) },
      'A task can have at most 20 assignees',
    ],
  ])('%s', async (_name, body, error) => {
    const response = await request(app)
      .patch(`/api/tasks/${task.id}/assignments`)
      .set('Authorization', authHeader())
      .send(body);

    expectError(response, 400, error);
  });

  it('DELETE /api/tasks/:id deletes a task', async () => {
    mocks.prisma.task.findFirst.mockResolvedValue({ id: task.id });
    mocks.prisma.task.delete.mockResolvedValue(task);

    const response = await request(app).delete(`/api/tasks/${task.id}`).set('Authorization', authHeader());

    expect(response.status).toBe(204);
    expect(response.text).toBe('');
    expect(mocks.prisma.task.delete).toHaveBeenCalledWith({ where: { id: task.id } });
    expect(mocks.prisma.comment.deleteMany).not.toHaveBeenCalled();
    expect(mocks.prisma.taskAssignment.deleteMany).not.toHaveBeenCalled();
    expect(mocks.prisma.taskTag.deleteMany).not.toHaveBeenCalled();
  });

  it('DELETE /api/tasks/:id reports missing tasks', async () => {
    mocks.prisma.task.findFirst.mockResolvedValue(null);

    const response = await request(app).delete('/api/tasks/missing').set('Authorization', authHeader());

    expectError(response, 404, 'Task not found');
  });

  it('DELETE /api/tasks/:id reports unexpected persistence errors', async () => {
    mocks.prisma.task.findFirst.mockResolvedValue({ id: task.id });
    mocks.prisma.task.delete.mockRejectedValue(new Error('database down'));

    const response = await request(app).delete(`/api/tasks/${task.id}`).set('Authorization', authHeader());

    expectError(response, 500, 'Failed to delete task');
  });
});

describe('comment endpoints', () => {
  it('GET /api/comments lists comments for an assigned task', async () => {
    mocks.prisma.task.findFirst.mockResolvedValue({ id: task.id });
    mocks.prisma.comment.findMany.mockResolvedValue([comment]);

    const response = await request(app)
      .get('/api/comments')
      .query({ taskId: ` ${task.id} ` })
      .set('Authorization', authHeader());

    expect(response.status).toBe(200);
    expect(response.body[0]).toMatchObject({ id: comment.id, content: comment.content });
  });

  it.each([
    ['GET /api/comments rejects missing task ids', {}, 'taskId query parameter is required'],
    ['GET /api/comments rejects blank task ids', { taskId: ' ' }, 'taskId must be a single string'],
    ['GET /api/comments rejects repeated task ids', { taskId: ['a', 'b'] }, 'taskId must be a single string'],
  ])('%s', async (_name, query, error) => {
    const response = await request(app)
      .get('/api/comments')
      .query(query)
      .set('Authorization', authHeader());

    expectError(response, 400, error);
  });

  it('GET /api/comments reports missing tasks', async () => {
    mocks.prisma.task.findFirst.mockResolvedValue(null);

    const response = await request(app)
      .get('/api/comments')
      .query({ taskId: 'missing' })
      .set('Authorization', authHeader());

    expectError(response, 404, 'Task not found');
  });

  it('GET /api/comments reports unexpected persistence errors', async () => {
    mocks.prisma.task.findFirst.mockRejectedValue(new Error('database down'));

    const response = await request(app)
      .get('/api/comments')
      .query({ taskId: task.id })
      .set('Authorization', authHeader());

    expectError(response, 500, 'Failed to fetch comments');
  });

  it('POST /api/comments creates a comment for an assigned task', async () => {
    mocks.prisma.task.findFirst.mockResolvedValue({ id: task.id });
    mocks.prisma.taskAssignment.findFirst.mockResolvedValue({ id: 'assignment-1' });
    mocks.prisma.comment.create.mockResolvedValue(comment);

    const response = await request(app)
      .post('/api/comments')
      .set('Authorization', authHeader())
      .send({
        taskId: ` ${task.id} `,
        content: ' Looks good ',
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ id: comment.id, content: comment.content });
    expect(mocks.prisma.comment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: {
        content: 'Looks good',
        taskId: task.id,
        userId: user.id,
      },
    }));
  });

  it('POST /api/comments reports unassigned tasks as missing', async () => {
    mocks.prisma.task.findFirst.mockResolvedValue(null);

    const response = await request(app)
      .post('/api/comments')
      .set('Authorization', authHeader())
      .send({ taskId: task.id, content: 'Comment' });

    expectError(response, 404, 'Task not found');
  });

  it.each([
    ['POST /api/comments rejects array bodies', [], 'Request body must be a JSON object'],
    ['POST /api/comments rejects missing task ids', { content: 'Comment' }, 'taskId is required'],
    ['POST /api/comments rejects missing content', { taskId: task.id }, 'Comment content is required'],
    [
      'POST /api/comments rejects long content',
      { taskId: task.id, content: 'c'.repeat(4001) },
      'Comment content must be 4000 characters or fewer',
    ],
  ])('%s', async (_name, body, error) => {
    const response = await request(app).post('/api/comments').set('Authorization', authHeader()).send(body);

    expectError(response, 400, error);
  });

  it('POST /api/comments reports missing tasks', async () => {
    mocks.prisma.task.findFirst.mockResolvedValue(null);

    const response = await request(app)
      .post('/api/comments')
      .set('Authorization', authHeader())
      .send({ taskId: 'missing', content: 'Comment' });

    expectError(response, 404, 'Task not found');
  });

  it('POST /api/comments reports unexpected persistence errors', async () => {
    mocks.prisma.task.findFirst.mockRejectedValue(new Error('database down'));

    const response = await request(app)
      .post('/api/comments')
      .set('Authorization', authHeader())
      .send({ taskId: task.id, content: 'Comment' });

    expectError(response, 500, 'Failed to create comment');
  });

  it('DELETE /api/comments/:id deletes an owned comment', async () => {
    mocks.prisma.comment.findFirst.mockResolvedValue({ id: comment.id });
    mocks.prisma.comment.delete.mockResolvedValue(comment);

    const response = await request(app).delete(`/api/comments/${comment.id}`).set('Authorization', authHeader());

    expect(response.status).toBe(204);
    expect(response.text).toBe('');
  });

  it('DELETE /api/comments/:id reports missing comments', async () => {
    mocks.prisma.comment.findFirst.mockResolvedValue(null);

    const response = await request(app).delete('/api/comments/missing').set('Authorization', authHeader());

    expectError(response, 404, 'Comment not found');
  });

  it('DELETE /api/comments/:id reports unexpected persistence errors', async () => {
    mocks.prisma.comment.findFirst.mockRejectedValue(new Error('database down'));

    const response = await request(app).delete(`/api/comments/${comment.id}`).set('Authorization', authHeader());

    expectError(response, 500, 'Failed to delete comment');
  });
});

describe('assistant endpoints', () => {
  it('GET /api/assistant/chats lists chats', async () => {
    mocks.prisma.assistantChat.findMany.mockResolvedValue([chatSnapshot]);

    const response = await request(app).get('/api/assistant/chats').set('Authorization', authHeader());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ chats: [expect.objectContaining({ id: chat.id })] });
  });

  it('GET /api/assistant/chats reports unexpected persistence errors', async () => {
    mocks.prisma.assistantChat.findMany.mockRejectedValue(new Error('database down'));

    const response = await request(app).get('/api/assistant/chats').set('Authorization', authHeader());

    expectError(response, 500, 'Failed to list assistant chats');
  });

  it('POST /api/assistant/chats creates a chat', async () => {
    mocks.prisma.assistantChat.create.mockResolvedValue(chatSnapshot);

    const response = await request(app).post('/api/assistant/chats').set('Authorization', authHeader());

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ chat: expect.objectContaining({ id: chat.id }) });
  });

  it('POST /api/assistant/chats reports unexpected persistence errors', async () => {
    mocks.prisma.assistantChat.create.mockRejectedValue(new Error('database down'));

    const response = await request(app).post('/api/assistant/chats').set('Authorization', authHeader());

    expectError(response, 500, 'Failed to create assistant chat');
  });

  it('GET /api/assistant/chats/:chatId returns a chat snapshot', async () => {
    mocks.prisma.assistantChat.findFirst.mockResolvedValue(chatSnapshot);

    const response = await request(app).get(`/api/assistant/chats/${chat.id}`).set('Authorization', authHeader());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ chat: expect.objectContaining({ id: chat.id }) });
  });

  it('GET /api/assistant/chats/:chatId rejects blank chat ids', async () => {
    const response = await request(app).get('/api/assistant/chats/%20').set('Authorization', authHeader());

    expectError(response, 400, 'Chat id is required');
  });

  it('GET /api/assistant/chats/:chatId reports missing chats', async () => {
    mocks.prisma.assistantChat.findFirst.mockResolvedValue(null);

    const response = await request(app).get('/api/assistant/chats/missing').set('Authorization', authHeader());

    expectError(response, 404, 'Chat not found');
  });

  it('GET /api/assistant/chats/:chatId reports unexpected persistence errors', async () => {
    mocks.prisma.assistantChat.findFirst.mockRejectedValue(new Error('database down'));

    const response = await request(app).get(`/api/assistant/chats/${chat.id}`).set('Authorization', authHeader());

    expectError(response, 500, 'Failed to fetch assistant chat');
  });

  it('POST /api/assistant/chats/:chatId/messages sends a message and stores a draft response', async () => {
    mocks.prisma.assistantChat.findFirst
      .mockResolvedValueOnce(chat)
      .mockResolvedValueOnce(chatSnapshot);
    mocks.prisma.assistantDraft.findFirst.mockResolvedValue(null);
    mocks.prisma.assistantChat.findUnique.mockResolvedValue({ title: 'New chat' });
    mocks.prisma.assistantMessage.findMany.mockResolvedValue([]);
    mocks.prisma.task.findMany.mockResolvedValue([]);
    mocks.generateAssistantResponse.mockResolvedValue({
      schemaVersion: 1,
      message: 'I drafted a task.',
      draft: validDraft,
    });
    mocks.prisma.assistantChat.update
      .mockResolvedValueOnce({ messageCount: 1 })
      .mockResolvedValueOnce({ messageCount: 2 });
    mocks.prisma.assistantMessage.create
      .mockResolvedValueOnce({ id: 'user-message-1' })
      .mockResolvedValueOnce({ id: 'assistant-message-1' });

    const response = await request(app)
      .post(`/api/assistant/chats/${chat.id}/messages`)
      .set('Authorization', authHeader())
      .send({ message: ' Please create a task ' });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ chat: expect.objectContaining({ id: chat.id }) });
    expect(mocks.generateAssistantResponse).toHaveBeenCalledWith(expect.objectContaining({
      userMessage: 'Please create a task',
    }));
    expect(mocks.prisma.assistantDraft.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        chatId: chat.id,
        status: 'PENDING',
      }),
    }));
  });

  it.each([
    ['POST /api/assistant/chats/:chatId/messages rejects array bodies', [], 'Request body must be a JSON object'],
    ['POST /api/assistant/chats/:chatId/messages rejects blank chat ids', { message: 'Hello' }, 'Chat id is required', '%20'],
  ])('%s', async (_name, body, error, chatId = chat.id) => {
    const response = await request(app)
      .post(`/api/assistant/chats/${chatId}/messages`)
      .set('Authorization', authHeader())
      .send(body);

    expectError(response, 400, error);
  });

  it('POST /api/assistant/chats/:chatId/messages reports missing chats', async () => {
    mocks.prisma.assistantChat.findFirst.mockResolvedValue(null);

    const response = await request(app)
      .post('/api/assistant/chats/missing/messages')
      .set('Authorization', authHeader())
      .send({ message: 'Hello' });

    expectError(response, 404, 'Chat not found');
  });

  it('POST /api/assistant/chats/:chatId/messages rejects invalid messages', async () => {
    mocks.prisma.assistantChat.findFirst.mockResolvedValue(chat);

    const response = await request(app)
      .post(`/api/assistant/chats/${chat.id}/messages`)
      .set('Authorization', authHeader())
      .send({ message: ' ' });

    expectError(response, 400, 'Message is required');
  });

  it('POST /api/assistant/chats/:chatId/messages sends pending drafts to the model for revision context', async () => {
    const pendingDraft = {
      id: 'draft-1',
      originalDraft: validDraft,
      createdAt: now,
      updatedAt: now,
    };
    mocks.prisma.assistantChat.findFirst
      .mockResolvedValueOnce(chat)
      .mockResolvedValueOnce(chatSnapshot);
    mocks.prisma.assistantDraft.findFirst.mockResolvedValue(pendingDraft);
    mocks.prisma.assistantChat.findUnique.mockResolvedValue({ title: 'Existing title' });
    mocks.prisma.assistantMessage.findMany.mockResolvedValue([]);
    mocks.prisma.task.findMany.mockResolvedValue([]);

    const response = await request(app)
      .post(`/api/assistant/chats/${chat.id}/messages`)
      .set('Authorization', authHeader())
      .send({ message: 'Hello' });

    expect(response.status).toBe(201);
    expect(mocks.generateAssistantResponse).toHaveBeenCalledWith(expect.objectContaining({
      pendingDraft,
    }));
  });

  it('POST /api/assistant/chats/:chatId/messages reports provider failures', async () => {
    mocks.prisma.assistantChat.findFirst.mockResolvedValue(chat);
    mocks.prisma.assistantDraft.findFirst.mockResolvedValue(null);
    mocks.prisma.assistantChat.findUnique.mockResolvedValue({ title: 'Existing title' });
    mocks.prisma.assistantMessage.findMany.mockResolvedValue([]);
    mocks.prisma.task.findMany.mockResolvedValue([]);
    mocks.generateAssistantResponse.mockRejectedValue(new Error('provider down'));

    const response = await request(app)
      .post(`/api/assistant/chats/${chat.id}/messages`)
      .set('Authorization', authHeader())
      .send({ message: 'Hello' });

    expectError(response, 502, 'Assistant provider request failed');
  });

  it('POST /api/assistant/chats/:chatId/messages reports unexpected persistence errors', async () => {
    mocks.prisma.assistantChat.findFirst.mockRejectedValue(new Error('database down'));

    const response = await request(app)
      .post(`/api/assistant/chats/${chat.id}/messages`)
      .set('Authorization', authHeader())
      .send({ message: 'Hello' });

    expectError(response, 500, 'Failed to send assistant message');
  });

  it('PATCH /api/assistant/drafts/:draftId discards a pending draft', async () => {
    mocks.prisma.assistantDraft.findFirst.mockResolvedValue({
      id: 'draft-1',
      chatId: chat.id,
      status: 'PENDING',
    });
    mocks.prisma.assistantChat.findFirst.mockResolvedValue(chatSnapshot);

    const response = await request(app)
      .patch('/api/assistant/drafts/draft-1')
      .set('Authorization', authHeader())
      .send({ status: 'DISCARDED' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ chat: expect.objectContaining({ id: chat.id }) });
    expect(mocks.prisma.assistantDraft.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'DISCARDED' }),
    }));
  });

  it('PATCH /api/assistant/drafts/:draftId executes a pending draft', async () => {
    mocks.prisma.assistantDraft.findFirst.mockResolvedValue({
      id: 'draft-1',
      chatId: chat.id,
      status: 'PENDING',
    });
    mocks.prisma.assistantChat.findFirst.mockResolvedValue(chatSnapshot);

    const response = await request(app)
      .patch('/api/assistant/drafts/draft-1')
      .set('Authorization', authHeader())
      .send({ status: 'EXECUTED', approvedDraft: validDraft });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      chat: expect.objectContaining({ id: chat.id }),
      executionResult: successfulExecution,
    });
    expect(mocks.executeApprovedDraft).toHaveBeenCalledWith(user.id, validDraft);
  });

  it.each([
    ['PATCH /api/assistant/drafts/:draftId rejects array bodies', [], 'Request body must be a JSON object'],
    ['PATCH /api/assistant/drafts/:draftId rejects blank draft ids', { status: 'DISCARDED' }, 'Draft id is required', '%20'],
    ['PATCH /api/assistant/drafts/:draftId rejects invalid statuses', { status: 'PENDING' }, 'Draft status must be EXECUTED or DISCARDED'],
    [
      'PATCH /api/assistant/drafts/:draftId rejects discarded drafts with approvedDraft',
      { status: 'DISCARDED', approvedDraft: validDraft },
      'Discarding a draft must not include approvedDraft',
    ],
    [
      'PATCH /api/assistant/drafts/:draftId rejects executed drafts without approvedDraft',
      { status: 'EXECUTED' },
      'approvedDraft is required when executing a draft',
    ],
  ])('%s', async (_name, body, error, draftId = 'draft-1') => {
    const response = await request(app)
      .patch(`/api/assistant/drafts/${draftId}`)
      .set('Authorization', authHeader())
      .send(body);

    expectError(response, 400, error);
  });

  it('PATCH /api/assistant/drafts/:draftId reports missing drafts', async () => {
    mocks.prisma.assistantDraft.findFirst.mockResolvedValue(null);

    const response = await request(app)
      .patch('/api/assistant/drafts/missing')
      .set('Authorization', authHeader())
      .send({ status: 'DISCARDED' });

    expectError(response, 404, 'Draft not found');
  });

  it('PATCH /api/assistant/drafts/:draftId rejects drafts that are no longer pending', async () => {
    mocks.prisma.assistantDraft.findFirst.mockResolvedValue({
      id: 'draft-1',
      chatId: chat.id,
      status: 'EXECUTED',
    });

    const response = await request(app)
      .patch('/api/assistant/drafts/draft-1')
      .set('Authorization', authHeader())
      .send({ status: 'DISCARDED' });

    expectError(response, 409, 'Draft is no longer pending');
  });

  it('PATCH /api/assistant/drafts/:draftId returns failed execution details', async () => {
    mocks.prisma.assistantDraft.findFirst.mockResolvedValue({
      id: 'draft-1',
      chatId: chat.id,
      status: 'PENDING',
    });
    mocks.prisma.assistantChat.findFirst.mockResolvedValue(chatSnapshot);
    mocks.executeApprovedDraft.mockRejectedValue(new mocks.DraftExecutionError('Task not found'));

    const response = await request(app)
      .patch('/api/assistant/drafts/draft-1')
      .set('Authorization', authHeader())
      .send({ status: 'EXECUTED', approvedDraft: validDraft });

    expect(response.status).toBe(409);
    expect(response.body.error).toBe('Task not found');
    expect(response.body.executionResult).toMatchObject({
      ok: false,
      operations: [
        {
          operationId: 'op-1',
          type: 'create_task',
          ok: false,
          error: 'Task not found',
        },
      ],
    });
  });

  it('PATCH /api/assistant/drafts/:draftId reports unexpected persistence errors', async () => {
    mocks.prisma.assistantDraft.findFirst.mockRejectedValue(new Error('database down'));

    const response = await request(app)
      .patch('/api/assistant/drafts/draft-1')
      .set('Authorization', authHeader())
      .send({ status: 'DISCARDED' });

    expectError(response, 500, 'Failed to update assistant draft');
  });
});

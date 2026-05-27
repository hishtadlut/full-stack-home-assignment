import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { AuthProvider } from '../auth/AuthProvider';
import { jsonResponse, requestUrl, seededUser } from '../test/apiTestUtils';
import type { Task } from '../types';

const tasks: Task[] = [
  {
    id: 'task-1',
    title: 'Implement user authentication',
    description: 'Add login and registration functionality',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    userId: seededUser.id,
    createdAt: new Date('2026-05-01T10:00:00.000Z').toISOString(),
    updatedAt: new Date('2026-05-02T10:00:00.000Z').toISOString(),
  },
];

let actor: ReturnType<typeof userEvent.setup>;
let taskRequestUrls: string[];

describe('Feature: dashboard filters are reflected in the URL and task requests', () => {
  beforeEach(() => {
    actor = userEvent.setup();
    taskRequestUrls = [];
    localStorage.setItem('token', 'auth-token');
    vi.stubGlobal('fetch', vi.fn(apiResponseFor));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('updates search, status, and priority without leaving the dashboard', async () => {
    renderAppAt('/dashboard');

    await screen.findByRole('heading', { name: /^dashboard$/i });

    await actor.selectOptions(screen.getByLabelText(/^status$/i), 'IN_PROGRESS');
    await actor.selectOptions(screen.getByLabelText(/^priority$/i), 'HIGH');
    await actor.type(screen.getByLabelText(/^search$/i), 'auth');

    await waitFor(() => {
      expect(window.location.pathname).toBe('/dashboard');
      expect(window.location.search).toContain('status=IN_PROGRESS');
      expect(window.location.search).toContain('priority=HIGH');
      expect(window.location.search).toContain('search=auth');
    });

    await waitFor(() => {
      expect(taskRequestUrls.some((url) =>
        url.includes('/api/tasks')
        && url.includes('status=IN_PROGRESS')
        && url.includes('priority=HIGH')
        && url.includes('search=auth'),
      )).toBe(true);
    });
  });
});

const renderAppAt = (path: string) => {
  window.history.pushState({}, '', path);
  render(
    <AuthProvider>
      <App />
    </AuthProvider>,
  );
};

const apiResponseFor = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = requestUrl(input);
  const method = init?.method ?? 'GET';

  if (method === 'GET' && url.endsWith('/api/auth/me')) {
    return jsonResponse({ user: seededUser });
  }

  if (method === 'GET' && url.includes('/api/tasks')) {
    taskRequestUrls.push(url);
    return jsonResponse(tasks);
  }

  throw new Error(`Unexpected request: ${method} ${url}`);
};

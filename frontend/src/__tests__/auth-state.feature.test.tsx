import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { AuthProvider } from '../auth/AuthProvider';

vi.mock('../hooks/useTasks', () => ({
  useTasks: () => ({
    tasks: [],
    loading: false,
    createTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    refetch: vi.fn(),
  }),
}));

const seededUser = {
  id: 'user-1',
  email: 'john@example.com',
  username: 'johndoe',
  name: 'John Doe',
};

const seededCredentials = {
  email: seededUser.email,
  password: 'password123',
};

const validToken = 'auth-token';
let actor: ReturnType<typeof userEvent.setup>;

describe('Feature: auth state refreshes route guards without a browser reload', () => {
  beforeEach(() => {
    actor = userEvent.setup();
    localStorage.clear();
    stubApi();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('Scenario: logging in immediately opens the protected dashboard', async () => {
    await givenIAmAnAnonymousVisitorOnTheLoginPage();

    await whenISubmitValidCredentials();

    await thenTheDashboardShouldBeVisible();
  });

  it('Scenario: logging out immediately hides the protected dashboard', async () => {
    await givenIAmAnAuthenticatedUserOnTheDashboard();

    await whenILogOut();

    await thenTheLoginPageShouldBeVisible();
  });
});

const givenIAmAnAnonymousVisitorOnTheLoginPage = async () => {
  renderAppAt('/login');

  await expectLoginPage();
};

const givenIAmAnAuthenticatedUserOnTheDashboard = async () => {
  localStorage.setItem('token', validToken);
  renderAppAt('/dashboard');

  await expectDashboard();
};

const whenISubmitValidCredentials = async () => {
  await actor.type(screen.getByLabelText(/^email$/i), seededCredentials.email);
  await actor.type(screen.getByLabelText(/^password$/i), seededCredentials.password);
  await actor.click(screen.getByRole('button', { name: /^login$/i }));
};

const whenILogOut = async () => {
  await actor.click(screen.getByRole('button', { name: /^logout$/i }));
};

const thenTheDashboardShouldBeVisible = async () => {
  expect(localStorage.getItem('token')).toBe(validToken);
  await expectDashboard();
  expect(screen.getByText(`Welcome, ${seededUser.name}!`)).toBeInTheDocument();
};

const thenTheLoginPageShouldBeVisible = async () => {
  expect(localStorage.getItem('token')).toBeNull();
  await expectLoginPage();
  expect(screen.queryByRole('heading', { name: /^dashboard$/i })).not.toBeInTheDocument();
};

const expectLoginPage = async () => {
  await expectPageHeading(/^login$/i, 'login');
};

const expectDashboard = async () => {
  await expectPageHeading(/^dashboard$/i, 'dashboard');
};

const expectPageHeading = async (name: RegExp, pageName: string) => {
  await waitFor(
    () => {
      expect(screen.queryByRole('heading', { name })).toBeInTheDocument();
    },
    {
      onTimeout: () => new Error(`Expected the ${pageName} page to be visible`),
    },
  );
};

const renderAppAt = (path: string) => {
  window.history.pushState({}, '', path);
  render(
    <AuthProvider>
      <App />
    </AuthProvider>,
  );
};

const stubApi = () => {
  vi.stubGlobal('fetch', vi.fn(apiResponseFor));
};

const apiResponseFor = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = requestUrl(input);
  const method = init?.method ?? 'GET';

  if (method === 'POST' && url.endsWith('/api/auth/login')) {
    return jsonResponse({ token: validToken, user: seededUser });
  }

  if (method === 'POST' && url.endsWith('/api/auth/refresh')) {
    return jsonResponse({ error: 'Refresh token required' }, { status: 401 });
  }

  if (method === 'DELETE' && url.endsWith('/api/auth/refresh')) {
    return new Response(null, { status: 204 });
  }

  if (method === 'GET' && url.endsWith('/api/auth/me')) {
    return jsonResponse({ user: seededUser });
  }

  throw new Error(`Unexpected request: ${method} ${url}`);
};

const requestUrl = (input: RequestInfo | URL) => {
  if (typeof input === 'string') {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  return input.url;
};

const jsonResponse = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

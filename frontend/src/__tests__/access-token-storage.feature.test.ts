import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearAccessToken,
  discardPersistedAccessToken,
  setAccessToken,
} from '../auth/accessToken';
import { api } from '../services/api';

describe('Feature: access tokens stay out of browser storage', () => {
  beforeEach(() => {
    clearAccessToken();
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse({ ok: true }))));
  });

  afterEach(() => {
    clearAccessToken();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('Scenario: legacy stored tokens are discarded and not used for API auth', async () => {
    localStorage.setItem('token', 'legacy-token');

    discardPersistedAccessToken();
    await api.get('/tasks');

    expect(localStorage.getItem('token')).toBeNull();
    expect(lastFetchHeaders().get('Authorization')).toBeNull();
  });

  it('Scenario: API auth uses only the in-memory access token', async () => {
    setAccessToken('fresh-access-token');

    await api.get('/tasks');

    expect(localStorage.getItem('token')).toBeNull();
    expect(lastFetchHeaders().get('Authorization')).toBe('Bearer fresh-access-token');

    clearAccessToken();
    await api.get('/tasks');

    expect(lastFetchHeaders().get('Authorization')).toBeNull();
  });
});

const lastFetchHeaders = () => {
  const fetchMock = vi.mocked(fetch);
  const [, init] = fetchMock.mock.calls.at(-1) ?? [];
  return new Headers(init?.headers);
};

const jsonResponse = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

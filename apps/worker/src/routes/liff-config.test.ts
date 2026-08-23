import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { liffRoutes } from './liff.js';
import type { Env } from '../index.js';

type AccountRow = {
  id: string;
  name: string;
  channel_access_token: string | null;
};

function makeDb(account: AccountRow | null): D1Database {
  return {
    prepare: vi.fn(() => ({
      bind: vi.fn(() => ({
        first: vi.fn(async () => account),
      })),
    })),
  } as unknown as D1Database;
}

function app(account: AccountRow | null = null) {
  const h = new Hono<Env>();
  h.route('/', liffRoutes);
  const env = {
    DB: makeDb(account),
    LIFF_URL: 'https://liff.line.me/1000000000-DefaultAA',
    LINE_CHANNEL_ACCESS_TOKEN: 'env-token',
  } as unknown as Env['Bindings'];
  return { h, env };
}

describe('GET /api/liff/config', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ basicId: '@bot' }), { status: 200 })),
    );
  });

  it('rejects malformed liffId without calling LINE API', async () => {
    const { h, env } = app();

    const res = await h.request('/api/liff/config?liffId=not-a-liff-id', {}, env);

    expect(res.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects unknown liffId without calling LINE API', async () => {
    const { h, env } = app();

    const res = await h.request('/api/liff/config?liffId=2000000000-UnknownAA', {}, env);

    expect(res.status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('allows the configured default LIFF ID', async () => {
    const { h, env } = app();

    const res = await h.request('/api/liff/config?liffId=1000000000-DefaultAA', {}, env);

    expect(res.status).toBe(200);
    expect(fetch).toHaveBeenCalledWith('https://api.line.me/v2/bot/info', {
      headers: { Authorization: 'Bearer env-token' },
    });
    await expect(res.json()).resolves.toMatchObject({
      success: true,
      data: { botBasicId: '@bot', accountName: 'Default', accountId: 'default' },
    });
  });

  it('allows an active DB-backed LIFF ID', async () => {
    const { h, env } = app({
      id: 'acct-1',
      name: 'Account One',
      channel_access_token: 'acct-token',
    });

    const res = await h.request('/api/liff/config?liffId=2000000000-AcctOne', {}, env);

    expect(res.status).toBe(200);
    expect(fetch).toHaveBeenCalledWith('https://api.line.me/v2/bot/info', {
      headers: { Authorization: 'Bearer acct-token' },
    });
    await expect(res.json()).resolves.toMatchObject({
      success: true,
      data: { botBasicId: '@bot', accountName: 'Account One', accountId: 'acct-1' },
    });
  });
});

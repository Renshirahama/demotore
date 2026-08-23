import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { liffRoutes } from './liff.js';
import type { Env } from '../index.js';

const dbMocks = vi.hoisted(() => ({
  getLineAccounts: vi.fn(),
  getFriendByLineUserId: vi.fn(),
}));

vi.mock('@line-crm/db', () => ({
  getFriendByLineUserId: dbMocks.getFriendByLineUserId,
  getLineAccounts: dbMocks.getLineAccounts,
}));

function app() {
  const h = new Hono<Env>();
  h.route('/', liffRoutes);
  const env = {
    DB: {} as D1Database,
    LINE_LOGIN_CHANNEL_ID: 'login-main',
  } as unknown as Env['Bindings'];
  return { h, env };
}

function mockLineVerify(sub: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ sub }), { status: 200 })),
  );
}

function mockLineVerifyForChannel(loginChannelId: string, sub: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = init?.body as URLSearchParams;
      if (body.get('client_id') === loginChannelId) {
        return new Response(JSON.stringify({ sub }), { status: 200 });
      }
      return new Response('invalid', { status: 400 });
    }),
  );
}

describe('POST /api/liff/profile auth', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    dbMocks.getLineAccounts.mockResolvedValue([]);
    dbMocks.getFriendByLineUserId.mockResolvedValue({
      id: 'friend-1',
      display_name: 'User One',
      is_following: 1,
      user_id: 'uuid-1',
    });
  });

  it('rejects requests without an id_token', async () => {
    const { h, env } = app();

    const res = await h.request(
      '/api/liff/profile',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ lineUserId: 'U1' }),
      },
      env,
    );

    expect(res.status).toBe(401);
    expect(dbMocks.getFriendByLineUserId).not.toHaveBeenCalled();
  });

  it('rejects when body lineUserId does not match the id_token subject', async () => {
    mockLineVerify('U2');
    const { h, env } = app();

    const res = await h.request(
      '/api/liff/profile',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer token' },
        body: JSON.stringify({ lineUserId: 'U1' }),
      },
      env,
    );

    expect(res.status).toBe(403);
    expect(dbMocks.getFriendByLineUserId).not.toHaveBeenCalled();
  });

  it('returns only the verified caller profile', async () => {
    mockLineVerify('U1');
    const { h, env } = app();

    const res = await h.request(
      '/api/liff/profile',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer token' },
        body: JSON.stringify({ lineUserId: 'U1' }),
      },
      env,
    );

    expect(res.status).toBe(200);
    expect(dbMocks.getFriendByLineUserId).toHaveBeenCalledWith(expect.anything(), 'U1');
    await expect(res.json()).resolves.toMatchObject({
      success: true,
      data: {
        id: 'friend-1',
        displayName: 'User One',
        isFollowing: true,
        userId: 'uuid-1',
      },
    });
  });

  it('looks up the profile in the account whose Login channel verified the id_token', async () => {
    dbMocks.getLineAccounts.mockResolvedValue([
      { id: 'acct-2', login_channel_id: 'login-acct-2' },
    ]);
    mockLineVerifyForChannel('login-acct-2', 'U1');
    const { h, env } = app();

    const res = await h.request(
      '/api/liff/profile',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer token' },
        body: JSON.stringify({ lineUserId: 'U1' }),
      },
      env,
    );

    expect(res.status).toBe(200);
    expect(dbMocks.getFriendByLineUserId).toHaveBeenCalledWith(expect.anything(), 'U1', {
      lineAccountId: 'acct-2',
    });
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { forms } from './forms.js';
import type { Env } from '../index.js';

const dbMocks = vi.hoisted(() => ({
  getLineAccounts: vi.fn(),
  getFriendByLineUserId: vi.fn(),
  getFriendById: vi.fn(),
  getFormById: vi.fn(),
  createFormSubmission: vi.fn(),
  jstNow: vi.fn(() => '2026-01-01T00:00:00.000+09:00'),
}));

vi.mock('@line-crm/db', () => ({
  getForms: vi.fn(),
  getFormsWithStats: vi.fn(),
  getFormById: dbMocks.getFormById,
  createForm: vi.fn(),
  updateForm: vi.fn(),
  deleteForm: vi.fn(),
  getFormSubmissions: vi.fn(),
  createFormSubmission: dbMocks.createFormSubmission,
  getFriendByLineUserId: dbMocks.getFriendByLineUserId,
  getFriendById: dbMocks.getFriendById,
  addTagToFriend: vi.fn(),
  enrollFriendInScenario: vi.fn(),
  getLineAccounts: dbMocks.getLineAccounts,
  jstNow: dbMocks.jstNow,
}));

function appWithDb(db: D1Database) {
  const app = new Hono<Env>();
  app.route('/', forms);
  return { app, env: { DB: db, LINE_LOGIN_CHANNEL_ID: 'login-main' } as unknown as Env['Bindings'] };
}

function dbWithUpdateCapture() {
  const updates: Array<{ metadata: string; friendId: string }> = [];
  const db = {
    prepare: vi.fn(() => ({
      bind: vi.fn((metadata: string, _updatedAt: string, friendId: string) => ({
        run: vi.fn(async () => {
          updates.push({ metadata, friendId });
          return { success: true, meta: { changes: 1 } };
        }),
      })),
    })),
  } as unknown as D1Database;
  return { db, updates };
}

function dbWithFormOpenCapture() {
  const opens: Array<{ formId: string; friendId: string | null; friendName: string | null }> = [];
  const db = {
    prepare: vi.fn(() => ({
      bind: vi.fn((_id: string, formId: string, friendId: string | null, friendName: string | null) => ({
        run: vi.fn(async () => {
          opens.push({ formId, friendId, friendName });
          return { success: true, meta: { changes: 1 } };
        }),
      })),
    })),
  } as unknown as D1Database;
  return { db, opens };
}

function mockLineVerify(sub: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ sub }),
    })),
  );
}

function mockLineVerifyForChannel(loginChannelId: string, sub: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = init?.body as URLSearchParams;
      return {
        ok: body.get('client_id') === loginChannelId,
        json: async () => ({ sub }),
      };
    }),
  );
}

describe('forms LIFF friend binding auth', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    dbMocks.getLineAccounts.mockResolvedValue([]);
    dbMocks.getFormById.mockResolvedValue({
      id: 'form-1',
      fields: '[]',
      is_active: 1,
      save_to_metadata: 0,
      on_submit_webhook_url: null,
      on_submit_tag_id: null,
      on_submit_scenario_id: null,
    });
    dbMocks.createFormSubmission.mockResolvedValue({
      id: 'submission-1',
      form_id: 'form-1',
      friend_id: null,
      data: '{}',
      created_at: '2026-01-01T00:00:00.000+09:00',
    });
    dbMocks.getFriendByLineUserId.mockResolvedValue({
      id: 'friend-1',
      line_user_id: 'U1',
      display_name: 'User One',
      metadata: '{"keep":true}',
    });
  });

  it('rejects partial metadata writes without an id_token', async () => {
    const { db, updates } = dbWithUpdateCapture();
    const { app, env } = appWithDb(db);

    const res = await app.request(
      '/api/forms/form-1/partial',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ lineUserId: 'U1', data: { plan: 'gold' } }),
      },
      env,
    );

    expect(res.status).toBe(401);
    expect(updates).toEqual([]);
  });

  it('rejects partial metadata writes when id_token belongs to another LINE user', async () => {
    mockLineVerify('U2');
    const { db, updates } = dbWithUpdateCapture();
    const { app, env } = appWithDb(db);

    const res = await app.request(
      '/api/forms/form-1/partial',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer token' },
        body: JSON.stringify({ lineUserId: 'U1', data: { plan: 'gold' } }),
      },
      env,
    );

    expect(res.status).toBe(403);
    expect(updates).toEqual([]);
  });

  it('allows partial metadata writes for the verified LINE user only', async () => {
    mockLineVerify('U1');
    const { db, updates } = dbWithUpdateCapture();
    const { app, env } = appWithDb(db);

    const res = await app.request(
      '/api/forms/form-1/partial',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer token' },
        body: JSON.stringify({ lineUserId: 'U1', data: { plan: 'gold' } }),
      },
      env,
    );

    expect(res.status).toBe(200);
    expect(updates).toEqual([
      { friendId: 'friend-1', metadata: JSON.stringify({ keep: true, plan: 'gold' }) },
    ]);
  });

  it('rejects friend-bound submits without an id_token', async () => {
    const { db } = dbWithUpdateCapture();
    const { app, env } = appWithDb(db);

    const res = await app.request(
      '/api/forms/form-1/submit',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ lineUserId: 'U1', data: { plan: 'gold' } }),
      },
      env,
    );

    expect(res.status).toBe(401);
    expect(dbMocks.createFormSubmission).not.toHaveBeenCalled();
  });

  it('records anonymous opens instead of trusting body friendId without an id_token', async () => {
    const { db, opens } = dbWithFormOpenCapture();
    const { app, env } = appWithDb(db);

    const res = await app.request(
      '/api/forms/form-1/opened',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ lineUserId: 'U1', friendId: 'spoofed-friend' }),
      },
      env,
    );

    expect(res.status).toBe(200);
    expect(dbMocks.getFriendById).not.toHaveBeenCalled();
    expect(dbMocks.getFriendByLineUserId).not.toHaveBeenCalled();
    expect(opens).toEqual([{ formId: 'form-1', friendId: null, friendName: null }]);
  });

  it('records anonymous opens when the lineUserId hint does not match the id_token', async () => {
    mockLineVerify('U2');
    const { db, opens } = dbWithFormOpenCapture();
    const { app, env } = appWithDb(db);

    const res = await app.request(
      '/api/forms/form-1/opened',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer token' },
        body: JSON.stringify({ lineUserId: 'U1', friendId: 'spoofed-friend' }),
      },
      env,
    );

    expect(res.status).toBe(200);
    expect(dbMocks.getFriendByLineUserId).not.toHaveBeenCalled();
    expect(opens).toEqual([{ formId: 'form-1', friendId: null, friendName: null }]);
  });

  it('records opens for the verified LINE user only', async () => {
    mockLineVerify('U1');
    const { db, opens } = dbWithFormOpenCapture();
    const { app, env } = appWithDb(db);

    const res = await app.request(
      '/api/forms/form-1/opened',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer token' },
        body: JSON.stringify({ lineUserId: 'U1', friendId: 'spoofed-friend' }),
      },
      env,
    );

    expect(res.status).toBe(200);
    expect(dbMocks.getFriendByLineUserId).toHaveBeenCalledWith(expect.anything(), 'U1');
    expect(opens).toEqual([{ formId: 'form-1', friendId: 'friend-1', friendName: 'User One' }]);
  });

  it('uses the account whose Login channel verified form friends', async () => {
    dbMocks.getLineAccounts.mockResolvedValue([
      { id: 'acct-2', login_channel_id: 'login-acct-2' },
    ]);
    mockLineVerifyForChannel('login-acct-2', 'U1');
    const { db, updates } = dbWithUpdateCapture();
    const { app, env } = appWithDb(db);

    const res = await app.request(
      '/api/forms/form-1/partial',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer token' },
        body: JSON.stringify({ lineUserId: 'U1', data: { plan: 'gold' } }),
      },
      env,
    );

    expect(res.status).toBe(200);
    expect(dbMocks.getFriendByLineUserId).toHaveBeenCalledWith(expect.anything(), 'U1', {
      lineAccountId: 'acct-2',
    });
    expect(updates).toHaveLength(1);
  });
});

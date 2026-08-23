import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { liffRoutes } from './liff.js';
import type { Env } from '../index.js';

const dbMocks = vi.hoisted(() => ({
  getLineAccounts: vi.fn(),
  getFriendByLineUserId: vi.fn(),
  getLineAccountById: vi.fn(),
  getTrackedLinkById: vi.fn(),
  getMessageTemplateById: vi.fn(),
}));

const lineMocks = vi.hoisted(() => ({
  pushMessage: vi.fn(),
  constructedTokens: [] as string[],
}));

vi.mock('@line-crm/db', () => ({
  getLineAccounts: dbMocks.getLineAccounts,
  getFriendByLineUserId: dbMocks.getFriendByLineUserId,
  getLineAccountById: dbMocks.getLineAccountById,
  getTrackedLinkById: dbMocks.getTrackedLinkById,
  getMessageTemplateById: dbMocks.getMessageTemplateById,
  jstNow: () => '2026-08-23 00:00:00',
}));

vi.mock('@line-crm/line-sdk', () => ({
  LineClient: class {
    constructor(token: string) {
      lineMocks.constructedTokens.push(token);
    }

    pushMessage = lineMocks.pushMessage;
  },
}));

function app() {
  const h = new Hono<Env>();
  h.route('/', liffRoutes);
  const env = {
    DB: {} as D1Database,
    LINE_LOGIN_CHANNEL_ID: 'login-main',
    LINE_CHANNEL_ACCESS_TOKEN: 'env-token',
    LIFF_URL: 'https://liff.line.me/1000000000-DefaultAA',
  } as unknown as Env['Bindings'];
  return { h, env };
}

function mockVerifyForAccount(loginChannelId: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = init?.body as URLSearchParams;
      const clientId = body.get('client_id');
      if (clientId === loginChannelId) {
        return new Response(JSON.stringify({ sub: 'U1' }), { status: 200 });
      }
      return new Response('invalid', { status: 400 });
    }),
  );
}

describe('POST /api/liff/send-form-link account scope', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    lineMocks.constructedTokens.length = 0;
    lineMocks.pushMessage.mockResolvedValue(undefined);
    dbMocks.getLineAccounts.mockResolvedValue([
      {
        id: 'acct-2',
        login_channel_id: 'login-acct-2',
        channel_access_token: 'acct-2-token',
        liff_id: '2000000000-AcctTwo',
      },
    ]);
    dbMocks.getFriendByLineUserId.mockResolvedValue({
      id: 'friend-acct-2',
      line_user_id: 'U1',
      line_account_id: 'acct-2',
    });
    dbMocks.getLineAccountById.mockResolvedValue({
      id: 'acct-2',
      channel_access_token: 'acct-2-token',
      liff_id: '2000000000-AcctTwo',
    });
    dbMocks.getTrackedLinkById.mockResolvedValue(null);
    dbMocks.getMessageTemplateById.mockResolvedValue(null);
  });

  it('looks up the friend in the account whose Login channel verified the id_token', async () => {
    mockVerifyForAccount('login-acct-2');
    const { h, env } = app();

    const res = await h.request(
      '/api/liff/send-form-link',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          lineUserId: 'U1',
          formId: 'form-1',
          idToken: 'id-token',
        }),
      },
      env,
    );

    expect(res.status).toBe(200);
    expect(dbMocks.getFriendByLineUserId).toHaveBeenCalledWith(expect.anything(), 'U1', {
      lineAccountId: 'acct-2',
    });
    expect(dbMocks.getLineAccountById).toHaveBeenCalledWith(expect.anything(), 'acct-2');
    expect(lineMocks.constructedTokens).toEqual(['acct-2-token']);
    const pushed = lineMocks.pushMessage.mock.calls[0][1][0] as {
      contents: { footer: { contents: Array<{ action: { uri: string } }> } };
    };
    expect(pushed.contents.footer.contents[0].action.uri).toBe(
      'https://liff.line.me/2000000000-AcctTwo?page=form&id=form-1',
    );
  });
});

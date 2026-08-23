import { beforeEach, describe, expect, it, vi } from 'vitest';
import { verifyCallerLineIdentity } from './liff-auth.js';

const dbMocks = vi.hoisted(() => ({
  getLineAccounts: vi.fn(),
}));

vi.mock('@line-crm/db', () => ({
  getLineAccounts: dbMocks.getLineAccounts,
}));

function jwtWithPayload(payload: Record<string, unknown>) {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8')
    .toString('base64url');
  return `header.${encoded}.sig`;
}

function mockVerify(okClientId: string, sub = 'U1') {
  const seen: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = init?.body as URLSearchParams;
      const clientId = body.get('client_id') || '';
      seen.push(clientId);
      if (clientId === okClientId) {
        return new Response(JSON.stringify({ sub }), { status: 200 });
      }
      return new Response('invalid', { status: 400 });
    }),
  );
  return seen;
}

describe('verifyCallerLineIdentity', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    dbMocks.getLineAccounts.mockResolvedValue([]);
  });

  it('accepts a DB messaging channel_id and returns its line account id', async () => {
    dbMocks.getLineAccounts.mockResolvedValue([
      { id: 'acct-1', login_channel_id: null, channel_id: 'msg-1', liff_id: null },
    ]);
    const seen = mockVerify('msg-1');

    const identity = await verifyCallerLineIdentity('Bearer token', {
      DB: {} as D1Database,
      LINE_LOGIN_CHANNEL_ID: 'login-main',
    });

    expect(seen).toEqual(['login-main', 'msg-1']);
    expect(identity).toEqual({
      lineUserId: 'U1',
      loginChannelId: 'msg-1',
      lineAccountId: 'acct-1',
    });
  });

  it('accepts the LIFF ID prefix and returns its line account id', async () => {
    dbMocks.getLineAccounts.mockResolvedValue([
      { id: 'acct-2', login_channel_id: null, channel_id: null, liff_id: '2000000000-AbCdEf' },
    ]);
    const seen = mockVerify('2000000000');

    const identity = await verifyCallerLineIdentity('Bearer token', {
      DB: {} as D1Database,
      LINE_LOGIN_CHANNEL_ID: undefined,
    });

    expect(seen).toEqual(['2000000000']);
    expect(identity?.lineAccountId).toBe('acct-2');
    expect(identity?.loginChannelId).toBe('2000000000');
  });

  it('falls back to the JWT aud claim when no configured channel matches', async () => {
    const token = jwtWithPayload({ aud: 'aud-channel' });
    const seen = mockVerify('aud-channel');

    const identity = await verifyCallerLineIdentity(`Bearer ${token}`, {
      DB: {} as D1Database,
      LINE_LOGIN_CHANNEL_ID: 'login-main',
    });

    expect(seen).toEqual(['login-main', 'aud-channel']);
    expect(identity).toEqual({
      lineUserId: 'U1',
      loginChannelId: 'aud-channel',
      lineAccountId: null,
    });
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { calendar } from './calendar.js';
import type { Env } from '../index.js';

const dbMocks = vi.hoisted(() => ({
  getCalendarConnections: vi.fn(),
  getCalendarConnectionById: vi.fn(),
  createCalendarConnection: vi.fn(),
  deleteCalendarConnection: vi.fn(),
  getCalendarBookings: vi.fn(),
  getCalendarBookingById: vi.fn(),
  createCalendarBooking: vi.fn(),
  updateCalendarBookingStatus: vi.fn(),
  updateCalendarBookingEventId: vi.fn(),
  getBookingsInRange: vi.fn(),
  getLineAccounts: vi.fn(),
  getFriendByLineUserId: vi.fn(),
}));

vi.mock('@line-crm/db', () => ({
  ...dbMocks,
  toJstString: (date: Date) => date.toISOString(),
}));

function app() {
  const h = new Hono<Env>();
  h.route('/', calendar);
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

describe('POST /api/integrations/google-calendar/book LIFF auth', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    dbMocks.getLineAccounts.mockResolvedValue([]);
    dbMocks.getFriendByLineUserId.mockResolvedValue({ id: 'friend-real', line_user_id: 'U1' });
    dbMocks.createCalendarBooking.mockImplementation(async (_db, input) => ({
      id: 'booking-1',
      connection_id: input.connectionId,
      friend_id: input.friendId ?? null,
      event_id: null,
      title: input.title,
      start_at: input.startAt,
      end_at: input.endAt,
      status: 'pending',
      metadata: input.metadata ?? null,
      created_at: '2026-08-23 00:00:00',
      updated_at: '2026-08-23 00:00:00',
    }));
    dbMocks.getCalendarConnectionById.mockResolvedValue(null);
  });

  it('uses the verified LINE friend instead of trusting body.friendId', async () => {
    mockLineVerify('U1');
    const { h, env } = app();

    const res = await h.request(
      '/api/integrations/google-calendar/book',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer id-token' },
        body: JSON.stringify({
          connectionId: 'conn-1',
          friendId: 'user-uuid-from-local-storage',
          title: '予約',
          startAt: '2026-08-24T10:00:00+09:00',
          endAt: '2026-08-24T11:00:00+09:00',
        }),
      },
      env,
    );

    expect(res.status).toBe(201);
    expect(dbMocks.getFriendByLineUserId).toHaveBeenCalledWith(expect.anything(), 'U1');
    expect(dbMocks.createCalendarBooking).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        friendId: 'friend-real',
      }),
    );
    await expect(res.json()).resolves.toMatchObject({
      success: true,
      data: { friendId: 'friend-real' },
    });
  });

  it('rejects booking creation when no LIFF idToken is supplied', async () => {
    const { h, env } = app();

    const res = await h.request(
      '/api/integrations/google-calendar/book',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          connectionId: 'conn-1',
          friendId: 'legacy-friend',
          title: '予約',
          startAt: '2026-08-24T10:00:00+09:00',
          endAt: '2026-08-24T11:00:00+09:00',
        }),
      },
      env,
    );

    expect(res.status).toBe(401);
    expect(dbMocks.getFriendByLineUserId).not.toHaveBeenCalled();
    expect(dbMocks.createCalendarBooking).not.toHaveBeenCalled();
    await expect(res.json()).resolves.toMatchObject({
      success: false,
      error: 'idToken required',
    });
  });
});

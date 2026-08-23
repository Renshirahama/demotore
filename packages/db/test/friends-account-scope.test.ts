import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getFriendByLineUserId, upsertFriend, updateFriendFollowStatus } from '../src/friends.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = join(__dirname, '..');

function asD1(sqlite: Database.Database): D1Database {
  return {
    prepare(query: string) {
      return {
        bind(...params: unknown[]) {
          const stmt = sqlite.prepare(query);
          return {
            async run() {
              const info = stmt.run(...params);
              return { results: [], success: true, meta: { changes: info.changes } };
            },
            async first<T>() {
              return (stmt.get(...params) as T) ?? null;
            },
            async all<T>() {
              return { results: stmt.all(...params) as T[], success: true, meta: {} };
            },
          };
        },
        async run() {
          const info = sqlite.prepare(query).run();
          return { results: [], success: true, meta: { changes: info.changes } };
        },
        async first<T>() {
          return (sqlite.prepare(query).get() as T) ?? null;
        },
        async all<T>() {
          return { results: sqlite.prepare(query).all() as T[], success: true, meta: {} };
        },
      };
    },
  } as unknown as D1Database;
}

function setupDb(): { sqlite: Database.Database; db: D1Database } {
  const sqlite = new Database(':memory:');
  sqlite.exec(readFileSync(join(PKG_ROOT, 'bootstrap.sql'), 'utf8'));
  sqlite
    .prepare(
      `INSERT INTO line_accounts (id, channel_id, name, channel_access_token, channel_secret)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run('acc-1', 'channel-1', 'Account 1', 'token-1', 'secret-1');
  sqlite
    .prepare(
      `INSERT INTO line_accounts (id, channel_id, name, channel_access_token, channel_secret)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run('acc-2', 'channel-2', 'Account 2', 'token-2', 'secret-2');
  return { sqlite, db: asD1(sqlite) };
}

describe('account-scoped friends', () => {
  it('allows the same line_user_id once per LINE account', async () => {
    const { sqlite, db } = setupDb();

    const a = await upsertFriend(db, {
      lineUserId: 'Ushared',
      lineAccountId: 'acc-1',
      displayName: 'Account 1',
    });
    const b = await upsertFriend(db, {
      lineUserId: 'Ushared',
      lineAccountId: 'acc-2',
      displayName: 'Account 2',
    });

    expect(a.id).not.toBe(b.id);
    expect(await getFriendByLineUserId(db, 'Ushared', { lineAccountId: 'acc-1' }))
      .toMatchObject({ id: a.id, display_name: 'Account 1' });
    expect(await getFriendByLineUserId(db, 'Ushared', { lineAccountId: 'acc-2' }))
      .toMatchObject({ id: b.id, display_name: 'Account 2' });

    const rows = sqlite
      .prepare(`SELECT id, line_account_id FROM friends WHERE line_user_id = ? ORDER BY line_account_id`)
      .all('Ushared');
    expect(rows).toEqual([
      { id: a.id, line_account_id: 'acc-1' },
      { id: b.id, line_account_id: 'acc-2' },
    ]);
  });

  it('claims a legacy null-account row for the first scoped upsert', async () => {
    const { sqlite, db } = setupDb();
    sqlite
      .prepare(
        `INSERT INTO friends (id, line_user_id, display_name, created_at, updated_at)
         VALUES ('legacy', 'Ulegacy', 'Legacy', '2026-01-01T00:00:00.000+09:00', '2026-01-01T00:00:00.000+09:00')`,
      )
      .run();

    const friend = await upsertFriend(db, {
      lineUserId: 'Ulegacy',
      lineAccountId: 'acc-1',
      displayName: 'Claimed',
    });

    expect(friend).toMatchObject({
      id: 'legacy',
      line_account_id: 'acc-1',
      display_name: 'Claimed',
    });
  });

  it('updates follow status only inside the requested account scope', async () => {
    const { db } = setupDb();
    const a = await upsertFriend(db, { lineUserId: 'Ushared', lineAccountId: 'acc-1' });
    const b = await upsertFriend(db, { lineUserId: 'Ushared', lineAccountId: 'acc-2' });

    await updateFriendFollowStatus(db, 'Ushared', false, { lineAccountId: 'acc-2' });

    expect(await getFriendByLineUserId(db, 'Ushared', { lineAccountId: 'acc-1' }))
      .toMatchObject({ id: a.id, is_following: 1 });
    expect(await getFriendByLineUserId(db, 'Ushared', { lineAccountId: 'acc-2' }))
      .toMatchObject({ id: b.id, is_following: 0 });
  });
});

import { Hono } from 'hono';
import { LineClient, type Message } from '@line-crm/line-sdk';
import type { Env } from '../index.js';

const REBNISE_CHANNEL_ID = '2010886778';
const MAX_LINE_TEXT_LENGTH = 5000;

type LineAccountRow = {
  id: string;
  name: string | null;
  channel_id: string | null;
  channel_access_token: string | null;
  is_active: number | boolean | null;
};

type FriendRow = {
  id: string;
  line_user_id: string;
  display_name: string | null;
};

type ContentPayload = {
  id?: unknown;
  title?: unknown;
  summary?: unknown;
  url?: unknown;
  publishedAt?: unknown;
  contentType?: unknown;
  lineAccountId?: unknown;
  channelId?: unknown;
  friendId?: unknown;
  dryRun?: unknown;
  force?: unknown;
};

export const contentNotifications = new Hono<Env>();

contentNotifications.post('/api/line/content-published', async (c) => {
  const configuredSecret = c.env.INTERNAL_NOTIFY_SECRET || c.env.CRON_SECRET;
  const providedSecret = c.req.header('x-internal-secret') || c.req.query('secret');
  if (!configuredSecret || providedSecret !== configuredSecret) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  let payload: ContentPayload;
  try {
    payload = await c.req.json<ContentPayload>();
  } catch {
    return c.json({ success: false, error: 'Invalid JSON body' }, 400);
  }

  const title = cleanString(payload.title);
  if (!title) {
    return c.json({ success: false, error: 'title is required' }, 400);
  }

  const account = await resolveLineAccount(c.env.DB, payload);
  if (!account) {
    return c.json({ success: false, error: 'Active LINE account not found' }, 404);
  }
  if (!account.channel_access_token && !c.env.LINE_CHANNEL_ACCESS_TOKEN) {
    return c.json({ success: false, error: 'LINE channel access token is not configured' }, 500);
  }

  const recipients = await resolveRecipients(c.env.DB, account.id, cleanString(payload.friendId));
  if (recipients.length === 0) {
    return c.json({
      success: true,
      skipped: true,
      reason: 'no_recipients',
      account: { id: account.id, name: account.name },
      recipients: 0,
    });
  }

  const contentId = contentIdForPayload(payload, title);
  const messageText = buildContentNotificationText({
    title,
    summary: cleanString(payload.summary),
    url: cleanString(payload.url),
    contentType: cleanString(payload.contentType),
  });
  const message: Message = { type: 'text', text: messageText };
  const dryRun = Boolean(payload.dryRun);
  const force = Boolean(payload.force);
  const isTargetedTest = Boolean(cleanString(payload.friendId));

  await ensureContentNotificationsTable(c.env.DB);

  if (!dryRun && !force && !isTargetedTest) {
    const inserted = await tryCreateContentNotification(c.env.DB, {
      lineAccountId: account.id,
      contentId,
      title,
      url: cleanString(payload.url),
      messageText,
    });
    if (!inserted) {
      return c.json({
        success: true,
        skipped: true,
        reason: 'already_sent',
        contentId,
        account: { id: account.id, name: account.name },
        recipients: recipients.length,
      });
    }
  }

  if (dryRun) {
    return c.json({
      success: true,
      dryRun: true,
      contentId,
      account: { id: account.id, name: account.name },
      recipients: recipients.length,
      message: messageText,
    });
  }

  const client = new LineClient(account.channel_access_token || c.env.LINE_CHANNEL_ACCESS_TOKEN);
  let sent = 0;
  let failed = 0;
  const errors: Array<{ friendId: string; message: string }> = [];

  for (const recipient of recipients) {
    try {
      await client.pushMessage(recipient.line_user_id, [message]);
      sent += 1;
      await c.env.DB.prepare(
        `INSERT INTO messages_log
          (id, friend_id, direction, message_type, content, broadcast_id, scenario_step_id, delivery_type, source, line_account_id, created_at)
         VALUES (?, ?, 'outgoing', 'text', ?, NULL, NULL, 'push', 'content-published', ?, datetime('now'))`,
      )
        .bind(crypto.randomUUID(), recipient.id, messageText, account.id)
        .run();
    } catch (err) {
      failed += 1;
      errors.push({
        friendId: recipient.id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  await upsertContentNotificationStats(c.env.DB, {
    lineAccountId: account.id,
    contentId,
    title,
    url: cleanString(payload.url),
    messageText,
    sent,
    failed,
  });

  return c.json({
    success: failed === 0,
    contentId,
    account: { id: account.id, name: account.name },
    recipients: recipients.length,
    sent,
    failed,
    errors,
  }, failed === 0 ? 200 : 207);
});

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function contentIdForPayload(payload: ContentPayload, title: string): string {
  const explicit = cleanString(payload.id) || cleanString(payload.url);
  if (explicit) return explicit.slice(0, 500);
  return `${title}:${cleanString(payload.publishedAt) || new Date().toISOString()}`.slice(0, 500);
}

function contentTypeLabel(contentType: string): string {
  const normalized = contentType.toLowerCase();
  if (['column', 'columns', 'コラム'].includes(normalized)) return 'コラム';
  if (['blog', 'blogs', 'ブログ'].includes(normalized)) return 'ブログ';
  if (['news', 'お知らせ', 'notice'].includes(normalized)) return 'お知らせ';
  if (['event', 'events', 'イベント'].includes(normalized)) return 'イベント情報';
  return contentType || '新しい投稿';
}

function buildContentNotificationText(input: {
  title: string;
  summary: string;
  url: string;
  contentType: string;
}): string {
  const label = contentTypeLabel(input.contentType);
  const lines = [
    '【新着のお知らせ】',
    `${label}が公開されました。`,
    '',
    input.title,
    input.summary ? `\n${input.summary.slice(0, 600)}` : '',
    input.url ? `\n${input.url}` : '',
  ];
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').slice(0, MAX_LINE_TEXT_LENGTH);
}

async function resolveLineAccount(db: D1Database, payload: ContentPayload): Promise<LineAccountRow | null> {
  const lineAccountId = cleanString(payload.lineAccountId);
  const channelId = cleanString(payload.channelId) || REBNISE_CHANNEL_ID;

  const byId = lineAccountId
    ? await db
        .prepare(
          `SELECT id, name, channel_id, channel_access_token, is_active
           FROM line_accounts
           WHERE id = ? AND is_active = 1
           LIMIT 1`,
        )
        .bind(lineAccountId)
        .first<LineAccountRow>()
    : null;
  if (byId) return byId;

  return db
    .prepare(
      `SELECT id, name, channel_id, channel_access_token, is_active
       FROM line_accounts
       WHERE channel_id = ? AND is_active = 1
       LIMIT 1`,
    )
    .bind(channelId)
    .first<LineAccountRow>();
}

async function resolveRecipients(
  db: D1Database,
  lineAccountId: string,
  friendId: string,
): Promise<FriendRow[]> {
  if (friendId) {
    const result = await db
      .prepare(
        `SELECT id, line_user_id, display_name
         FROM friends
         WHERE id = ? AND line_account_id = ? AND is_following = 1 AND line_user_id IS NOT NULL AND line_user_id != ''
         LIMIT 1`,
      )
      .bind(friendId, lineAccountId)
      .all<FriendRow>();
    return result.results ?? [];
  }

  const result = await db
    .prepare(
      `SELECT id, line_user_id, display_name
       FROM friends
       WHERE line_account_id = ? AND is_following = 1 AND line_user_id IS NOT NULL AND line_user_id != ''
       ORDER BY created_at ASC`,
    )
    .bind(lineAccountId)
    .all<FriendRow>();
  return result.results ?? [];
}

async function ensureContentNotificationsTable(db: D1Database): Promise<void> {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS content_notifications (
        id TEXT PRIMARY KEY,
        line_account_id TEXT NOT NULL,
        content_id TEXT NOT NULL,
        title TEXT NOT NULL,
        url TEXT,
        message_content TEXT NOT NULL,
        sent_count INTEGER NOT NULL DEFAULT 0,
        failed_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
    )
    .run();
  await db
    .prepare(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_content_notifications_account_content
       ON content_notifications(line_account_id, content_id)`,
    )
    .run();
}

async function tryCreateContentNotification(
  db: D1Database,
  input: {
    lineAccountId: string;
    contentId: string;
    title: string;
    url: string;
    messageText: string;
  },
): Promise<boolean> {
  const id = crypto.randomUUID();
  const result = await db
    .prepare(
      `INSERT OR IGNORE INTO content_notifications
        (id, line_account_id, content_id, title, url, message_content, sent_count, failed_count)
       VALUES (?, ?, ?, ?, ?, ?, 0, 0)`,
    )
    .bind(id, input.lineAccountId, input.contentId, input.title, input.url || null, input.messageText)
    .run();
  return Boolean(result.meta?.changes);
}

async function upsertContentNotificationStats(
  db: D1Database,
  input: {
    lineAccountId: string;
    contentId: string;
    title: string;
    url: string;
    messageText: string;
    sent: number;
    failed: number;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO content_notifications
        (id, line_account_id, content_id, title, url, message_content, sent_count, failed_count, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(line_account_id, content_id) DO UPDATE SET
        title = excluded.title,
        url = excluded.url,
        message_content = excluded.message_content,
        sent_count = sent_count + excluded.sent_count,
        failed_count = failed_count + excluded.failed_count,
        updated_at = datetime('now')`,
    )
    .bind(
      crypto.randomUUID(),
      input.lineAccountId,
      input.contentId,
      input.title,
      input.url || null,
      input.messageText,
      input.sent,
      input.failed,
    )
    .run();
}

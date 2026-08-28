import { Hono } from 'hono';
import { LineClient, type Message } from '@line-crm/line-sdk';
import type { Env } from '../index.js';

const REBNISE_CHANNEL_ID = '2010886778';
const REBNISE_RSS_URL = 'https://www.rebnise.jp/RSS.rdf';
const REBNISE_OGP_IMAGE_URL = 'https://www.rebnise.jp/files/user/_/common/img/libs/icon_ogp.png';
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

type ContentNotificationResult = {
  success: boolean;
  dryRun?: boolean;
  skipped?: boolean;
  reason?: string;
  contentId?: string;
  account?: { id: string; name: string | null };
  recipients?: number;
  sent?: number;
  failed?: number;
  errors?: Array<{ friendId: string; message: string }>;
  message?: string;
};

type RssEntry = {
  id: string;
  title: string;
  summary: string;
  url: string;
  updatedAt: string;
};

type RssSyncResult = {
  success: boolean;
  source: string;
  mode: 'baseline' | 'dry-run' | 'send';
  fetched: number;
  candidates: number;
  sent: number;
  failed: number;
  skipped: number;
  errors: Array<{ contentId: string; error: string }>;
  latestUpdatedAt: string | null;
};

export const contentNotifications = new Hono<Env>();

contentNotifications.post('/api/line/content-published', async (c) => {
  if (!isValidInternalRequest(c.env, c.req.header('x-internal-secret') || c.req.query('secret'))) {
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

  const result = await sendContentNotification(c.env.DB, c.env, payload);
  const status = result.success ? 200 : result.failed && result.failed > 0 && result.sent && result.sent > 0 ? 207 : 500;
  return c.json(result, status);
});

contentNotifications.post('/api/line/cron/rebnise-content-sync', async (c) => {
  if (!isValidInternalRequest(c.env, c.req.header('x-internal-secret') || c.req.query('secret'))) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  let body: { dryRun?: unknown; forceBaseline?: unknown } = {};
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }

  const result = await syncRebniseRssContent(c.env.DB, c.env, {
    dryRun: Boolean(body.dryRun),
    forceBaseline: Boolean(body.forceBaseline),
  });
  return c.json(result, result.success ? 200 : 500);
});

export async function sendContentNotification(
  db: D1Database,
  env: Pick<Env['Bindings'], 'LINE_CHANNEL_ACCESS_TOKEN'>,
  payload: ContentPayload,
): Promise<ContentNotificationResult> {
  const title = cleanString(payload.title);
  if (!title) return { success: false, reason: 'title_required' };

  const account = await resolveLineAccount(db, payload);
  if (!account) return { success: false, reason: 'account_not_found' };
  if (!account.channel_access_token && !env.LINE_CHANNEL_ACCESS_TOKEN) {
    return { success: false, reason: 'line_token_missing', account: { id: account.id, name: account.name } };
  }

  const recipients = await resolveRecipients(db, account.id, cleanString(payload.friendId));
  if (recipients.length === 0) {
    return {
      success: true,
      skipped: true,
      reason: 'no_recipients',
      account: { id: account.id, name: account.name },
      recipients: 0,
    };
  }

  const contentId = contentIdForPayload(payload, title);
  const messageText = buildContentNotificationText({
    title,
    summary: cleanString(payload.summary),
    url: cleanString(payload.url),
    contentType: cleanString(payload.contentType),
  });
  const message = buildContentNotificationMessage({
    title,
    summary: cleanString(payload.summary),
    url: cleanString(payload.url),
    contentType: cleanString(payload.contentType),
  });
  const dryRun = Boolean(payload.dryRun);
  const force = Boolean(payload.force);
  const isTargetedTest = Boolean(cleanString(payload.friendId));

  await ensureContentNotificationsTable(db);

  if (!dryRun && !force && !isTargetedTest) {
    const inserted = await tryCreateContentNotification(db, {
      lineAccountId: account.id,
      contentId,
      title,
      url: cleanString(payload.url),
      messageText,
    });
    if (!inserted) {
      return {
        success: true,
        skipped: true,
        reason: 'already_sent',
        contentId,
        account: { id: account.id, name: account.name },
        recipients: recipients.length,
      };
    }
  }

  if (dryRun) {
    return {
      success: true,
      dryRun: true,
      contentId,
      account: { id: account.id, name: account.name },
      recipients: recipients.length,
      message: messageText,
    };
  }

  const client = new LineClient(account.channel_access_token || env.LINE_CHANNEL_ACCESS_TOKEN);
  let sent = 0;
  let failed = 0;
  const errors: Array<{ friendId: string; message: string }> = [];

  for (const recipient of recipients) {
    try {
      await client.pushMessage(recipient.line_user_id, [message]);
      sent += 1;
      await db.prepare(
        `INSERT INTO messages_log
          (id, friend_id, direction, message_type, content, broadcast_id, scenario_step_id, delivery_type, source, line_account_id, created_at)
         VALUES (?, ?, 'outgoing', ?, ?, NULL, NULL, 'push', 'content-published', ?, datetime('now'))`,
      )
        .bind(
          crypto.randomUUID(),
          recipient.id,
          message.type === 'flex' ? 'flex' : 'text',
          message.type === 'flex' ? JSON.stringify(message.contents) : messageText,
          account.id,
        )
        .run();
    } catch (err) {
      failed += 1;
      errors.push({
        friendId: recipient.id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  await upsertContentNotificationStats(db, {
    lineAccountId: account.id,
    contentId,
    title,
    url: cleanString(payload.url),
    messageText,
    sent,
    failed,
  });

  return {
    success: failed === 0,
    contentId,
    account: { id: account.id, name: account.name },
    recipients: recipients.length,
    sent,
    failed,
    errors,
  };
}

export async function syncRebniseRssContent(
  db: D1Database,
  env: Pick<Env['Bindings'], 'LINE_CHANNEL_ACCESS_TOKEN'>,
  options: { dryRun?: boolean; forceBaseline?: boolean } = {},
): Promise<RssSyncResult> {
  await ensureContentNotificationsTable(db);
  await ensureContentSyncStateTable(db);

  const source = 'rebnise-rss';
  const entries = await fetchRebniseRssEntries();
  const latestUpdatedAt = entries.reduce<string | null>((latest, entry) => {
    if (!entry.updatedAt) return latest;
    return !latest || new Date(entry.updatedAt).getTime() > new Date(latest).getTime() ? entry.updatedAt : latest;
  }, null);

  const state = await db
    .prepare('SELECT last_seen_updated_at FROM content_sync_state WHERE source = ? LIMIT 1')
    .bind(source)
    .first<{ last_seen_updated_at: string | null }>();

  if (!state || options.forceBaseline) {
    await baselineEntries(db, entries);
    await upsertContentSyncState(db, source, latestUpdatedAt);
    return {
      success: true,
      source,
      mode: 'baseline',
      fetched: entries.length,
      candidates: 0,
      sent: 0,
      failed: 0,
      skipped: entries.length,
      errors: [],
      latestUpdatedAt,
    };
  }

  const lastSeenMs = state.last_seen_updated_at ? new Date(state.last_seen_updated_at).getTime() : 0;
  const candidates = entries
    .filter((entry) => !entry.updatedAt || new Date(entry.updatedAt).getTime() > lastSeenMs)
    .sort((a, b) => new Date(a.updatedAt || 0).getTime() - new Date(b.updatedAt || 0).getTime());

  const result: RssSyncResult = {
    success: true,
    source,
    mode: options.dryRun ? 'dry-run' : 'send',
    fetched: entries.length,
    candidates: candidates.length,
    sent: 0,
    failed: 0,
    skipped: 0,
    errors: [],
    latestUpdatedAt,
  };

  for (const entry of candidates) {
    try {
      const sendResult = await sendContentNotification(db, env, {
        id: entry.id || entry.url,
        title: entry.title,
        summary: entry.summary,
        url: entry.url,
        publishedAt: entry.updatedAt,
        contentType: inferContentType(entry),
        dryRun: options.dryRun,
      });
      result.sent += sendResult.sent ?? 0;
      result.failed += sendResult.failed ?? 0;
      if (sendResult.skipped) result.skipped += 1;
      if (!sendResult.success) {
        result.success = false;
        result.errors.push({ contentId: entry.id || entry.url, error: sendResult.reason || 'send_failed' });
      }
    } catch (err) {
      result.success = false;
      result.failed += 1;
      result.errors.push({
        contentId: entry.id || entry.url,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (!options.dryRun) {
    await upsertContentSyncState(db, source, latestUpdatedAt ?? state.last_seen_updated_at);
  }

  return result;
}

function isValidInternalRequest(
  env: Pick<Env['Bindings'], 'INTERNAL_NOTIFY_SECRET' | 'CRON_SECRET'>,
  providedSecret: string | undefined,
): boolean {
  const configuredSecret = env.INTERNAL_NOTIFY_SECRET || env.CRON_SECRET;
  return Boolean(configuredSecret && providedSecret && providedSecret === configuredSecret);
}

async function fetchRebniseRssEntries(): Promise<RssEntry[]> {
  const response = await fetch(REBNISE_RSS_URL, {
    headers: {
      Accept: 'application/atom+xml, application/rss+xml, text/xml;q=0.9, */*;q=0.1',
      'User-Agent': 'LineHarnessRebniseContentSync/1.0',
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch Rebnise RSS: ${response.status}`);
  }

  const xml = await response.text();
  return parseAtomEntries(xml).slice(0, 20);
}

function parseAtomEntries(xml: string): RssEntry[] {
  const entries: RssEntry[] = [];
  const entryPattern = /<entry\b[\s\S]*?<\/entry>/gi;
  const blocks = xml.match(entryPattern) ?? [];

  for (const block of blocks) {
    const id = xmlText(block, 'id');
    const title = stripHtml(xmlText(block, 'title'));
    const summary = stripHtml(xmlText(block, 'summary') || xmlText(block, 'content')).slice(0, 700);
    const updatedAt = xmlText(block, 'updated') || xmlText(block, 'published');
    const link = linkHref(block) || id;
    if (!title || !link) continue;
    entries.push({ id: id || link, title, summary, url: link, updatedAt });
  }

  return entries;
}

function xmlText(block: string, tag: string): string {
  const pattern = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = block.match(pattern);
  return match ? decodeEntities(stripCdata(match[1]).trim()) : '';
}

function linkHref(block: string): string {
  const alternate = block.match(/<link\b[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["'][^>]*\/?>/i);
  if (alternate) return decodeEntities(alternate[1]);
  const anyLink = block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
  return anyLink ? decodeEntities(anyLink[1]) : '';
}

function stripCdata(value: string): string {
  return value.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '');
}

function stripHtml(value: string): string {
  return decodeEntities(
    value
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\r/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
  );
}

function decodeEntities(value: string): string {
  const named: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
  };
  return value
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (_whole, entity: string) => {
      const lower = entity.toLowerCase();
      if (lower.startsWith('#x')) return String.fromCodePoint(Number.parseInt(lower.slice(2), 16));
      if (lower.startsWith('#')) return String.fromCodePoint(Number.parseInt(lower.slice(1), 10));
      return named[lower] ?? `&${entity};`;
    })
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n');
}

function inferContentType(entry: RssEntry): string {
  const text = `${entry.title} ${entry.url}`.toLowerCase();
  if (text.includes('column') || text.includes('コラム')) return 'コラム';
  if (text.includes('blog') || text.includes('ブログ')) return 'ブログ';
  if (text.includes('event') || text.includes('イベント')) return 'イベント';
  if (text.includes('ticket') || text.includes('チケット')) return 'お知らせ';
  return 'お知らせ';
}

async function ensureContentSyncStateTable(db: D1Database): Promise<void> {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS content_sync_state (
        source TEXT PRIMARY KEY,
        last_seen_updated_at TEXT,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
    )
    .run();
}

async function upsertContentSyncState(
  db: D1Database,
  source: string,
  lastSeenUpdatedAt: string | null,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO content_sync_state (source, last_seen_updated_at, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(source) DO UPDATE SET
        last_seen_updated_at = excluded.last_seen_updated_at,
        updated_at = datetime('now')`,
    )
    .bind(source, lastSeenUpdatedAt)
    .run();
}

async function baselineEntries(db: D1Database, entries: RssEntry[]): Promise<void> {
  const account = await resolveLineAccount(db, { channelId: REBNISE_CHANNEL_ID });
  if (!account) return;
  for (const entry of entries) {
    await tryCreateContentNotification(db, {
      lineAccountId: account.id,
      contentId: entry.id || entry.url,
      title: entry.title,
      url: entry.url,
      messageText: buildContentNotificationText({
        title: entry.title,
        summary: entry.summary,
        url: entry.url,
        contentType: inferContentType(entry),
      }),
    });
  }
}

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
  const topic = buildTopicLine(input.title, input.summary, label);
  const hook = buildHookLine(input.title, input.summary, label);
  const lines = [
    `【${label}】${topic}`,
    hook,
    '',
    input.title,
    input.summary ? `\n${input.summary.slice(0, 220)}` : '',
    input.url ? `\n${input.url}` : '',
  ];
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').slice(0, MAX_LINE_TEXT_LENGTH);
}

function buildContentNotificationMessage(input: {
  title: string;
  summary: string;
  url: string;
  contentType: string;
}): Message {
  const url = safeHttpsUrl(input.url);
  if (!url) return { type: 'text', text: buildContentNotificationText(input) };

  const label = contentTypeLabel(input.contentType);
  const title = input.title.slice(0, 120);
  const topic = buildTopicLine(input.title, input.summary, label);
  const hook = buildHookLine(input.title, input.summary, label);
  const summary = buildSummaryLine(input.summary, input.title);

  return {
    type: 'flex',
    altText: `${label}: ${topic}`.slice(0, 400),
    contents: {
      type: 'bubble',
      size: 'mega',
      hero: {
        type: 'image',
        url: REBNISE_OGP_IMAGE_URL,
        size: 'full',
        aspectRatio: '20:9',
        aspectMode: 'cover',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          {
            type: 'text',
            text: label,
            weight: 'bold',
            color: '#E60033',
            size: 'sm',
          },
          {
            type: 'text',
            text: topic,
            weight: 'bold',
            size: 'md',
            color: '#333333',
            wrap: true,
          },
          {
            type: 'text',
            text: title,
            weight: 'bold',
            size: 'xl',
            color: '#111111',
            wrap: true,
          },
          {
            type: 'text',
            text: hook,
            size: 'sm',
            color: '#E60033',
            wrap: true,
            margin: 'sm',
          },
          {
            type: 'text',
            text: summary,
            size: 'sm',
            color: '#555555',
            wrap: true,
            margin: 'sm',
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#E60033',
            height: 'sm',
            action: {
              type: 'uri',
              label: `${label}を見る`.slice(0, 20),
              uri: url,
            },
          },
          {
            type: 'button',
            style: 'secondary',
            height: 'sm',
            action: {
              type: 'uri',
              label: 'ニュース一覧',
              uri: 'https://www.rebnise.jp/news/',
            },
          },
        ],
      },
    },
  };
}

function safeHttpsUrl(value: string): string {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function buildTopicLine(title: string, summary: string, label: string): string {
  const source = `${title} ${summary}`.replace(/\s+/g, ' ');
  if (/チケット|招待|優待|席|観戦/.test(source)) return 'チケット・観戦に関するお知らせ';
  if (/試合|ホーム戦|節|vs|VS|対戦|GAME/i.test(source)) return '試合に関するお知らせ';
  if (/イベント|FES|フェス|開催/.test(source)) return 'イベント開催のお知らせ';
  if (/スポンサー|パートナー|企業/.test(source)) return 'スポンサー・パートナー向け情報';
  if (/グッズ|ユニフォーム|販売/.test(source)) return 'グッズ・ユニフォーム情報';
  if (/選手|チーム|キャプテン|スタッフ|契約|加入|退団/.test(source)) return 'チーム情報のお知らせ';
  if (/メディア|出演|放送|掲載/.test(source)) return 'メディア掲載のお知らせ';
  if (label === 'コラム') return 'レブナイズを深く知れるコラム';
  if (label === 'ブログ') return 'クラブの近況がわかるブログ';
  return 'レブナイズの最新情報';
}

function buildHookLine(title: string, summary: string, label: string): string {
  const source = `${title} ${summary}`;
  if (/チケット|招待|優待|席|観戦/.test(source)) return '行く前にチェックしておきたい内容です。';
  if (/試合|ホーム戦|節|vs|VS|対戦|GAME/i.test(source)) return '試合前に見ておくと楽しみやすいです。';
  if (/イベント|FES|フェス|開催/.test(source)) return '参加予定の方は早めにチェック。';
  if (/スポンサー|パートナー|企業/.test(source)) return 'スポンサー企業のみなさま向けの最新トピックです。';
  if (/グッズ|ユニフォーム|販売/.test(source)) return '気になる人は売り切れ前にチェック。';
  if (/選手|チーム|キャプテン|スタッフ|契約|加入|退団/.test(source)) return 'チームの今を知れるニュースです。';
  if (label === 'コラム') return '読みものとしてサクッと追えます。';
  return '気になる内容をカードからそのまま見られます。';
}

function buildSummaryLine(summary: string, title: string): string {
  const cleaned = (summary || title)
    .replace(/\s+/g, ' ')
    .replace(/いつも鹿児島レブナイズの応援誠にありがとうございます。?/g, '')
    .trim();
  return (cleaned || 'レブナイズの新着情報が公開されました。').slice(0, 150);
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

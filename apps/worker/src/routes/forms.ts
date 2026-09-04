import { Hono, type Context } from 'hono';
import {
  getForms,
  getFormsWithStats,
  getFormById,
  createForm,
  updateForm,
  deleteForm,
  getFormSubmissions,
  createFormSubmission,
  jstNow,
} from '@line-crm/db';
import { getFriendByLineUserId, getFriendById } from '@line-crm/db';
import { addTagToFriend, enrollFriendInScenario } from '@line-crm/db';
import type {
  Form as DbForm,
  FormSubmission as DbFormSubmission,
  FormUsedByAccount,
} from '@line-crm/db';
import { mergeFriendMetadata, parseFriendMetadata } from '../lib/friend-metadata.js';
import { verifyCallerLineIdentity } from '../services/liff-auth.js';
import type { Env } from '../index.js';

const forms = new Hono<Env>();

const MONEY_DIAGNOSIS_FORM_ID = 'money-diagnosis-v1';
const MONEY_DIAGNOSIS_TAGS = {
  completed: 'tag-money-diagnosis-completed',
  typeA: 'tag-money-type-a',
  typeB: 'tag-money-type-b',
  typeC: 'tag-money-type-c',
} as const;

type MoneyDiagnosisType = 'A' | 'B' | 'C';

const MONEY_DIAGNOSIS_SCENARIOS: Record<MoneyDiagnosisType, string> = {
  A: 'scenario-money-education-7day-type-a-v1',
  B: 'scenario-money-education-7day-type-b-v1',
  C: 'scenario-money-education-7day-type-c-v1',
};

function asStringValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(',');
  return value == null ? '' : String(value);
}

function classifyMoneyDiagnosis(data: Record<string, unknown>): {
  type: MoneyDiagnosisType;
  label: string;
  tagId: string;
  summary: string;
  nextAction: string;
  ctaLabel: string;
  ctaText: string;
} {
  const purpose = asStringValue(data.purpose);
  const experience = asStringValue(data.experience);
  const pain = asStringValue(data.pain);

  if (
    purpose.includes('AI研修') ||
    pain.includes('AI人材') ||
    pain.includes('開発人材')
  ) {
    return {
      type: 'C',
      label: '社内定着まで整える「AI研修・内製化支援タイプ」',
      tagId: MONEY_DIAGNOSIS_TAGS.typeC,
      summary:
        'AI活用を一部の担当者だけで終わらせず、現場で使える状態にする支援が向いています。研修、運用ルール、伴走支援をセットで整理すると進めやすい状態です。',
      nextAction:
        'まずは現在の業務課題と社内体制を整理し、AI研修・定着支援の進め方を確認しましょう。',
      ctaLabel: 'AI研修について',
      ctaText: 'AI研修について知りたい',
    };
  }

  if (
    purpose.includes('開発') ||
    purpose.includes('実装') ||
    experience.includes('具体的に検討中') ||
    experience.includes('予算あり')
  ) {
    return {
      type: 'B',
      label: '形にする相談が向いている「AI開発・実装相談タイプ」',
      tagId: MONEY_DIAGNOSIS_TAGS.typeB,
      summary:
        '課題や作りたいものが見え始めています。次は、要件整理、PoC、実装範囲、運用設計を具体化する段階です。',
      nextAction:
        '配信で進め方を確認し、必要なら「開発相談をする」と送ってください。担当者がヒアリングへ進めます。',
      ctaLabel: '開発相談をする',
      ctaText: '開発相談をする',
    };
  }

  return {
    type: 'A',
    label: 'まず方向性を整理する「AI活用検討タイプ」',
    tagId: MONEY_DIAGNOSIS_TAGS.typeA,
    summary:
      'AIやDXに関心はあるものの、最初に何を相談すべきかを整理する段階です。自社課題、活用領域、導入効果の見立てから始めると進めやすくなります。',
    nextAction:
      'Day1からの配信で、AI導入の考え方と相談前に整理するポイントを確認してください。',
    ctaLabel: '問い合わせしたい',
    ctaText: '問い合わせしたい',
  };
}

function buildMoneyDiagnosisFlex(
  displayName: string | null,
  diagnosis: ReturnType<typeof classifyMoneyDiagnosis>,
) {
  return {
    type: 'bubble',
    size: 'giga',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [
        { type: 'text', text: '相談タイプ診断結果', size: 'sm', color: '#0f766e', weight: 'bold' },
        { type: 'text', text: diagnosis.label, size: 'lg', color: '#111827', weight: 'bold', wrap: true, margin: 'sm' },
      ],
      paddingAll: '20px',
      backgroundColor: '#ecfdf5',
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: `${displayName || 'あなた'}さんの回答から、現在の相談タイプを判定しました。`,
          size: 'sm',
          color: '#374151',
          wrap: true,
        },
        { type: 'separator', margin: 'lg' },
        { type: 'text', text: diagnosis.summary, size: 'sm', color: '#111827', wrap: true, margin: 'lg' },
        {
          type: 'box',
          layout: 'vertical',
          margin: 'lg',
          paddingAll: '14px',
          backgroundColor: '#f9fafb',
          contents: [
            { type: 'text', text: '次にやること', size: 'xs', color: '#6b7280', weight: 'bold' },
            { type: 'text', text: diagnosis.nextAction, size: 'sm', color: '#111827', wrap: true, margin: 'sm' },
          ],
        },
      ],
      paddingAll: '20px',
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '18px',
      contents: [
        {
          type: 'button',
          style: 'primary',
          color: diagnosis.type === 'C' ? '#059669' : diagnosis.type === 'B' ? '#dc2626' : '#2563eb',
          action: {
            type: 'message',
            label: diagnosis.ctaLabel,
            text: diagnosis.ctaText,
          },
        },
      ],
    },
  };
}

async function getPublishedRichMenuIdForGroup(db: D1Database, groupId: string): Promise<string | null> {
  const row = await db
    .prepare(
      `SELECT p.line_richmenu_id AS richMenuId
         FROM rich_menu_groups g
         JOIN rich_menu_pages p ON p.group_id = g.id
        WHERE g.id = ?
          AND g.status = 'published'
          AND (p.id = g.default_page_id OR g.default_page_id IS NULL)
        ORDER BY p.order_index
        LIMIT 1`,
    )
    .bind(groupId)
    .first<{ richMenuId: string | null }>();
  return row?.richMenuId ?? null;
}

async function linkMoneyRichMenuAfterDiagnosis(
  db: D1Database,
  env: Env['Bindings'],
  friendId: string,
  diagnosisType: MoneyDiagnosisType,
) {
  const friend = await getFriendById(db, friendId);
  if (!friend?.line_user_id) return;

  const groupId = diagnosisType === 'C' ? 'rich-money-counseling' : 'rich-money-learning';
  const richMenuId = await getPublishedRichMenuIdForGroup(db, groupId);
  if (!richMenuId) return;

  const { LineClient } = await import('@line-crm/line-sdk');
  let accessToken = env.LINE_CHANNEL_ACCESS_TOKEN;
  const accountId = (friend as unknown as Record<string, string | null>).line_account_id;
  if (accountId) {
    const { getLineAccountById } = await import('@line-crm/db');
    const account = await getLineAccountById(db, accountId);
    if (account) accessToken = account.channel_access_token;
  }

  const lineClient = new LineClient(accessToken);
  await lineClient.linkRichMenuToUser(friend.line_user_id, richMenuId);
}

function serializeForm(
  row: DbForm,
  extra?: { lastSubmittedAt?: string | null; usedByAccounts?: FormUsedByAccount[] },
) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    fields: JSON.parse(row.fields || '[]') as unknown[],
    onSubmitTagId: row.on_submit_tag_id,
    onSubmitScenarioId: row.on_submit_scenario_id,
    onSubmitMessageType: row.on_submit_message_type,
    onSubmitMessageContent: row.on_submit_message_content,
    onSubmitWebhookUrl: row.on_submit_webhook_url,
    onSubmitWebhookHeaders: row.on_submit_webhook_headers,
    onSubmitWebhookFailMessage: row.on_submit_webhook_fail_message,
    saveToMetadata: Boolean(row.save_to_metadata),
    isActive: Boolean(row.is_active),
    submitCount: row.submit_count,
    ogTitle: row.og_title,
    ogDescription: row.og_description,
    ogImageUrl: row.og_image_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastSubmittedAt: extra?.lastSubmittedAt ?? null,
    usedByAccounts: extra?.usedByAccounts ?? [],
  };
}

function serializeSubmission(row: DbFormSubmission & { friend_name?: string | null }) {
  return {
    id: row.id,
    formId: row.form_id,
    friendId: row.friend_id,
    friendName: row.friend_name || null,
    data: JSON.parse(row.data || '{}') as Record<string, unknown>,
    createdAt: row.created_at,
  };
}

async function resolveVerifiedFormFriend(
  c: Context<Env>,
  body: { lineUserId?: string; friendId?: string },
) {
  const caller = await verifyCallerLineIdentity(c.req.header('Authorization'), c.env);
  if (!caller) {
    return { error: c.json({ success: false, error: 'idToken required' }, 401) };
  }
  if (body.lineUserId && body.lineUserId !== caller.lineUserId) {
    return { error: c.json({ success: false, error: 'Token mismatch' }, 403) };
  }
  const friend = caller.lineAccountId
    ? await getFriendByLineUserId(c.env.DB, caller.lineUserId, { lineAccountId: caller.lineAccountId })
    : await getFriendByLineUserId(c.env.DB, caller.lineUserId);
  if (!friend) {
    return { error: c.json({ success: false, error: 'Friend not found' }, 404) };
  }
  return { friend, callerLineUserId: caller.lineUserId };
}

// GET /api/forms — list all forms (with submission stats + delivering accounts)
forms.get('/api/forms', async (c) => {
  try {
    const items = await getFormsWithStats(c.env.DB);
    return c.json({
      success: true,
      data: items.map((row) =>
        serializeForm(row, {
          lastSubmittedAt: row.last_submitted_at,
          usedByAccounts: row.used_by_accounts,
        }),
      ),
    });
  } catch (err) {
    console.error('GET /api/forms error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// GET /api/forms/:id — get form
forms.get('/api/forms/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const form = await getFormById(c.env.DB, id);
    if (!form) {
      return c.json({ success: false, error: 'Form not found' }, 404);
    }
    return c.json({ success: true, data: serializeForm(form) });
  } catch (err) {
    console.error('GET /api/forms/:id error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// POST /api/forms — create form
forms.post('/api/forms', async (c) => {
  try {
    const body = await c.req.json<{
      name: string;
      description?: string | null;
      fields?: unknown[];
      onSubmitTagId?: string | null;
      onSubmitScenarioId?: string | null;
      onSubmitMessageType?: 'text' | 'flex' | null;
      onSubmitMessageContent?: string | null;
      onSubmitWebhookUrl?: string | null;
      onSubmitWebhookHeaders?: string | null;
      onSubmitWebhookFailMessage?: string | null;
      saveToMetadata?: boolean;
      ogTitle?: string | null;
      ogDescription?: string | null;
      ogImageUrl?: string | null;
    }>();

    if (!body.name) {
      return c.json({ success: false, error: 'name is required' }, 400);
    }

    const form = await createForm(c.env.DB, {
      name: body.name,
      description: body.description ?? null,
      fields: JSON.stringify(body.fields ?? []),
      onSubmitTagId: body.onSubmitTagId ?? null,
      onSubmitScenarioId: body.onSubmitScenarioId ?? null,
      onSubmitMessageType: body.onSubmitMessageType ?? null,
      onSubmitMessageContent: body.onSubmitMessageContent ?? null,
      onSubmitWebhookUrl: body.onSubmitWebhookUrl ?? null,
      onSubmitWebhookHeaders: body.onSubmitWebhookHeaders ?? null,
      onSubmitWebhookFailMessage: body.onSubmitWebhookFailMessage ?? null,
      saveToMetadata: body.saveToMetadata,
      ogTitle: body.ogTitle ?? null,
      ogDescription: body.ogDescription ?? null,
      ogImageUrl: body.ogImageUrl ?? null,
    });

    return c.json({ success: true, data: serializeForm(form) }, 201);
  } catch (err) {
    console.error('POST /api/forms error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// PUT /api/forms/:id — update form
forms.put('/api/forms/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json<{
      name?: string;
      description?: string | null;
      fields?: unknown[];
      onSubmitTagId?: string | null;
      onSubmitScenarioId?: string | null;
      onSubmitMessageType?: 'text' | 'flex' | null;
      onSubmitMessageContent?: string | null;
      onSubmitWebhookUrl?: string | null;
      onSubmitWebhookHeaders?: string | null;
      onSubmitWebhookFailMessage?: string | null;
      saveToMetadata?: boolean;
      isActive?: boolean;
      ogTitle?: string | null;
      ogDescription?: string | null;
      ogImageUrl?: string | null;
    }>();

    // Only include fields that were explicitly sent (avoid undefined → null conversion)
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.fields !== undefined) updates.fields = JSON.stringify(body.fields);
    if (body.onSubmitTagId !== undefined) updates.onSubmitTagId = body.onSubmitTagId;
    if (body.onSubmitScenarioId !== undefined) updates.onSubmitScenarioId = body.onSubmitScenarioId;
    if (body.onSubmitMessageType !== undefined) updates.onSubmitMessageType = body.onSubmitMessageType;
    if (body.onSubmitMessageContent !== undefined) updates.onSubmitMessageContent = body.onSubmitMessageContent;
    if (body.onSubmitWebhookUrl !== undefined) updates.onSubmitWebhookUrl = body.onSubmitWebhookUrl;
    if (body.onSubmitWebhookHeaders !== undefined) updates.onSubmitWebhookHeaders = body.onSubmitWebhookHeaders;
    if (body.onSubmitWebhookFailMessage !== undefined) updates.onSubmitWebhookFailMessage = body.onSubmitWebhookFailMessage;
    if (body.saveToMetadata !== undefined) updates.saveToMetadata = body.saveToMetadata;
    if (body.isActive !== undefined) updates.isActive = body.isActive;
    if (body.ogTitle !== undefined) updates.ogTitle = body.ogTitle;
    if (body.ogDescription !== undefined) updates.ogDescription = body.ogDescription;
    if (body.ogImageUrl !== undefined) updates.ogImageUrl = body.ogImageUrl;

    const updated = await updateForm(c.env.DB, id, updates as any);

    if (!updated) {
      return c.json({ success: false, error: 'Form not found' }, 404);
    }

    return c.json({ success: true, data: serializeForm(updated) });
  } catch (err) {
    console.error('PUT /api/forms/:id error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// DELETE /api/forms/:id
forms.delete('/api/forms/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const form = await getFormById(c.env.DB, id);
    if (!form) {
      return c.json({ success: false, error: 'Form not found' }, 404);
    }
    await deleteForm(c.env.DB, id);
    return c.json({ success: true, data: null });
  } catch (err) {
    console.error('DELETE /api/forms/:id error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// GET /api/forms/:id/submissions — list submissions
forms.get('/api/forms/:id/submissions', async (c) => {
  try {
    const id = c.req.param('id');
    const form = await getFormById(c.env.DB, id);
    if (!form) {
      return c.json({ success: false, error: 'Form not found' }, 404);
    }
    const submissions = await getFormSubmissions(c.env.DB, id);
    return c.json({ success: true, data: submissions.map(serializeSubmission) });
  } catch (err) {
    console.error('GET /api/forms/:id/submissions error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// POST /api/forms/:id/opened — record form open event (public, used by LIFF)
forms.post('/api/forms/:id/opened', async (c) => {
  try {
    const formId = c.req.param('id');
    const body = await c.req.json<{ lineUserId?: string; friendId?: string }>();

    // Open tracking is best-effort and may be anonymous, but never trust
    // friendId/lineUserId from the browser. If a LIFF id_token is present and
    // matches the optional lineUserId hint, attach the open to the verified
    // caller's friend row; otherwise record an anonymous open.
    let friend: Awaited<ReturnType<typeof getFriendByLineUserId>> | null = null;
    const caller = await verifyCallerLineIdentity(c.req.header('Authorization'), c.env);
    if (caller && (!body.lineUserId || body.lineUserId === caller.lineUserId)) {
      friend = caller.lineAccountId
        ? await getFriendByLineUserId(c.env.DB, caller.lineUserId, { lineAccountId: caller.lineAccountId })
        : await getFriendByLineUserId(c.env.DB, caller.lineUserId);
    }

    const now = jstNow();
    await c.env.DB.prepare(
      'INSERT INTO form_opens (id, form_id, friend_id, friend_name, opened_at) VALUES (?, ?, ?, ?, ?)',
    ).bind(
      crypto.randomUUID(),
      formId,
      friend?.id ?? null,
      friend?.display_name ?? null,
      now,
    ).run();

    return c.json({ success: true });
  } catch (err) {
    console.error('POST /api/forms/:id/opened error:', err);
    return c.json({ success: true }); // non-blocking, always succeed
  }
});

// POST /api/forms/:id/partial — save survey answers without x_username (public, used by LIFF page 1)
forms.post('/api/forms/:id/partial', async (c) => {
  try {
    const formId = c.req.param('id');
    const body = await c.req.json<{ lineUserId?: string; friendId?: string; data?: Record<string, unknown> }>();

    const verified = await resolveVerifiedFormFriend(c, body);
    if ('error' in verified) return verified.error;
    const { friend } = verified;

    // Save survey data to friend metadata (merge with existing)
    const merged = mergeFriendMetadata(friend.metadata, body.data ?? {});
    await c.env.DB.prepare(
      'UPDATE friends SET metadata = ?, updated_at = ? WHERE id = ?',
    ).bind(JSON.stringify(merged), jstNow(), friend.id).run();

    return c.json({ success: true });
  } catch (err) {
    console.error('POST /api/forms/:id/partial error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// POST /api/forms/:id/submit — submit form (public, used by LIFF)
forms.post('/api/forms/:id/submit', async (c) => {
  try {
    const formId = c.req.param('id');
    const form = await getFormById(c.env.DB, formId);
    if (!form) {
      return c.json({ success: false, error: 'Form not found' }, 404);
    }
    if (!form.is_active) {
      return c.json({ success: false, error: 'This form is no longer accepting responses' }, 400);
    }

    const body = await c.req.json<{
      lineUserId?: string;
      friendId?: string;
      data?: Record<string, unknown>;
      _skipWebhook?: boolean;
      trackedLinkId?: string;
    }>();

    const submissionData = body.data ?? {};

    // Validate required fields
    const fields = JSON.parse(form.fields || '[]') as Array<{
      name: string;
      label: string;
      type: string;
      required?: boolean;
    }>;

    for (const field of fields) {
      if (field.required) {
        const val = submissionData[field.name];
        if (val === undefined || val === null || val === '') {
          return c.json(
            { success: false, error: `${field.label} は必須項目です` },
            400,
          );
        }
      }
    }

    // Anonymous submissions are accepted, but friend-bound side effects require
    // a verified LIFF id_token. Do not trust lineUserId/friendId from the body.
    let friendId: string | null = null;
    const wantsFriendBinding = Boolean(body.lineUserId || body.friendId || body.trackedLinkId);
    if (wantsFriendBinding) {
      const verified = await resolveVerifiedFormFriend(c, body);
      if ('error' in verified) return verified.error;
      friendId = verified.friend.id;
    }

    // Webhook gate — skip if client pre-verified via repliers endpoint
    delete submissionData._webhookVerified;
    const skipWebhook = Boolean(body._skipWebhook);
    delete submissionData._skipWebhook;
    let webhookData: Record<string, unknown> | null = null;
    if (form.on_submit_webhook_url && !skipWebhook) {
      const webhookResult = await callFormWebhook(form, submissionData);
      webhookData = webhookResult.data as Record<string, unknown> | null;
      if (!webhookResult.passed) {
        // Webhook rejected — send fail message and stop
        if (form.on_submit_webhook_fail_message && friendId) {
          const friend = await getFriendById(c.env.DB, friendId);
          if (friend?.line_user_id) {
            try {
              const { LineClient } = await import('@line-crm/line-sdk');
              let accessToken = c.env.LINE_CHANNEL_ACCESS_TOKEN;
              if ((friend as unknown as Record<string, unknown>).line_account_id) {
                const { getLineAccountById } = await import('@line-crm/db');
                const account = await getLineAccountById(c.env.DB, (friend as unknown as Record<string, unknown>).line_account_id as string);
                if (account) accessToken = account.channel_access_token;
              }
              const lineClient = new LineClient(accessToken);
              await lineClient.pushMessage(friend.line_user_id, [{ type: 'text', text: form.on_submit_webhook_fail_message }]);
              await c.env.DB
                .prepare(
                  `INSERT INTO messages_log (id, friend_id, direction, message_type, content, broadcast_id, scenario_step_id, source, created_at)
                   VALUES (?, ?, 'outgoing', 'text', ?, NULL, NULL, 'auto_reply', ?)`,
                )
                .bind(crypto.randomUUID(), friend.id, form.on_submit_webhook_fail_message, jstNow())
                .run();
            } catch (e) {
              console.error('Failed to send webhook fail message:', e);
            }
          }
        }
        // Still save the submission for records
        const submission = await createFormSubmission(c.env.DB, {
          formId,
          friendId: friendId || null,
          data: JSON.stringify({ ...submissionData, _webhookResult: webhookResult.data }),
        });
        return c.json({ success: true, data: { ...serializeSubmission(submission), webhookPassed: false, webhookData: webhookResult.data } }, 201);
      }
    }

    // Save submission (friendId null if not resolved — avoids FK constraint)
    const submission = await createFormSubmission(c.env.DB, {
      formId,
      friendId: friendId || null,
      data: JSON.stringify(submissionData),
    });

    // Side effects (best-effort, don't fail the request)
    if (friendId) {
      const db = c.env.DB;
      const now = jstNow();

      // Resolve reward template per-campaign.
      //
      // Priority:
      //   1. body.trackedLinkId (= ?ref= from /r/:ref → LIFF → form). This lets
      //      X Harness campaign settings drive the reward, even for friends who
      //      were originally added via a different campaign.
      //   2. Fallback to friends.first_tracked_link_id (first-touch attribution)
      //      so existing tracked links without ref pass-through still work.
      //
      // This OVERRIDES form.on_submit_message_*.
      //
      // Note: anti-replay (preventing the same friend from claiming the same
      // reward twice via URL tampering) is intentionally NOT enforced. The
      // product is opt-in oriented and the engagement gate handles real
      // anti-fraud upstream.
      let rewardTemplate: import('@line-crm/db').MessageTemplate | null = null;
      {
        const { getFriendById, getTrackedLinkById, getMessageTemplateById } = await import('@line-crm/db');
        const { resolveRewardTemplate } = await import('../services/reward-resolver.js');
        rewardTemplate = await resolveRewardTemplate(
          db,
          {
            friendId,
            requestedTrackedLinkId: body.trackedLinkId ?? null,
          },
          { getFriendById, getTrackedLinkById, getMessageTemplateById },
        );
      }

      const sideEffects: Promise<unknown>[] = [];

      // Save response data to friend's metadata
      if (form.save_to_metadata) {
        sideEffects.push(
          (async () => {
            const friend = await getFriendById(db, friendId!);
            if (!friend) return;
            const merged = mergeFriendMetadata(friend.metadata, submissionData);
            await db
              .prepare(`UPDATE friends SET metadata = ?, updated_at = ? WHERE id = ?`)
              .bind(JSON.stringify(merged), now, friendId)
              .run();
          })(),
        );
      }

      // Add tag
      if (form.on_submit_tag_id) {
        sideEffects.push(addTagToFriend(db, friendId, form.on_submit_tag_id));
      }

      // Enroll in scenario
      if (form.on_submit_scenario_id && form.id !== MONEY_DIAGNOSIS_FORM_ID) {
        sideEffects.push(enrollFriendInScenario(db, friendId, form.on_submit_scenario_id));
      }

      if (form.id === MONEY_DIAGNOSIS_FORM_ID) {
        sideEffects.push(
          (async () => {
            const diagnosis = classifyMoneyDiagnosis(submissionData);
            await addTagToFriend(db, friendId, MONEY_DIAGNOSIS_TAGS.completed);
            await addTagToFriend(db, friendId, diagnosis.tagId);
            await enrollFriendInScenario(db, friendId, MONEY_DIAGNOSIS_SCENARIOS[diagnosis.type]);
            const { addMoneyScoreOnce, moneyScoreEventForDiagnosisType } = await import('../services/money-scoring.js');
            await addMoneyScoreOnce(db, friendId, moneyScoreEventForDiagnosisType(diagnosis.type));

            const friend = await getFriendById(db, friendId!);
            if (!friend) return;
            const existing = parseFriendMetadata(friend.metadata);
            const merged = {
              ...existing,
              money_diagnosis_type: diagnosis.type,
              money_diagnosis_label: diagnosis.label,
              money_status: 'diagnosed',
              money_stage: 'education_day_0',
              money_diagnosis_completed_at: now,
            };
            await db
              .prepare(`UPDATE friends SET metadata = ?, updated_at = ? WHERE id = ?`)
              .bind(JSON.stringify(merged), now, friendId)
              .run();
            await linkMoneyRichMenuAfterDiagnosis(db, c.env, friendId, diagnosis.type);
          })(),
        );
      }

      // If webhook returned a join_url (e.g. Meet Harness), send a Flex button to the user
      if (webhookData?.join_url) {
        sideEffects.push(
          (async () => {
            const friend = await getFriendById(db, friendId!);
            if (!friend?.line_user_id) return;
            const { LineClient } = await import('@line-crm/line-sdk');
            let accessToken = c.env.LINE_CHANNEL_ACCESS_TOKEN;
            if ((friend as unknown as Record<string, unknown>).line_account_id) {
              const { getLineAccountById } = await import('@line-crm/db');
              const account = await getLineAccountById(db, (friend as unknown as Record<string, unknown>).line_account_id as string);
              if (account) accessToken = account.channel_access_token;
            }
            const lineClient = new LineClient(accessToken);
            const joinUrl = String(webhookData!.join_url);
            const meetFlex = {
              type: 'bubble',
              header: {
                type: 'box', layout: 'vertical',
                contents: [
                  { type: 'text', text: 'ヒアリングの準備ができました', size: 'md', weight: 'bold', color: '#1e293b' },
                ],
                paddingAll: '20px', backgroundColor: '#f0f9ff',
              },
              body: {
                type: 'box', layout: 'vertical',
                contents: [
                  { type: 'text', text: 'アンケートありがとうございます。続けて短いヒアリングにご協力ください。', size: 'sm', color: '#475569', wrap: true },
                ],
                paddingAll: '20px',
              },
              footer: {
                type: 'box', layout: 'vertical',
                contents: [
                  {
                    type: 'button', style: 'primary', color: '#4CAF50',
                    action: { type: 'uri', label: 'ヒアリングを始める', uri: joinUrl },
                  },
                ],
                paddingAll: '16px',
              },
            };
            await lineClient.pushMessage(friend.line_user_id, [
              { type: 'flex', altText: 'ヒアリングの準備ができました', contents: meetFlex },
            ]);
            await db
              .prepare(
                `INSERT INTO messages_log (id, friend_id, direction, message_type, content, broadcast_id, scenario_step_id, source, created_at)
                 VALUES (?, ?, 'outgoing', 'flex', ?, NULL, NULL, 'auto_reply', ?)`,
              )
              .bind(crypto.randomUUID(), friend.id, JSON.stringify(meetFlex), jstNow())
              .run();
          })(),
        );
      }

      // Send confirmation message with submitted data back to user
      sideEffects.push(
        (async () => {
          const friend = await getFriendById(db, friendId!);
          if (!friend?.line_user_id) return;
          const { LineClient } = await import('@line-crm/line-sdk');
          // Resolve access token from friend's account (multi-account support)
          let accessToken = c.env.LINE_CHANNEL_ACCESS_TOKEN;
          if ((friend as unknown as Record<string, unknown>).line_account_id) {
            const { getLineAccountById } = await import('@line-crm/db');
            const account = await getLineAccountById(db, (friend as unknown as Record<string, unknown>).line_account_id as string);
            if (account) accessToken = account.channel_access_token;
          }
          const lineClient = new LineClient(accessToken);
          const { buildMessage, expandVariables } = await import('../services/step-delivery.js');
          const apiOrigin = new URL(c.req.url).origin;
          const { resolveMetadata } = await import('../services/step-delivery.js');
          const resolvedMeta = await resolveMetadata(c.env.DB, { user_id: (friend as unknown as Record<string, string | null>).user_id, metadata: (friend as unknown as Record<string, string | null>).metadata });
          const friendData = {
            id: friend.id,
            display_name: friend.display_name,
            user_id: (friend as unknown as Record<string, string | null>).user_id,
            ref_code: (friend as unknown as Record<string, string | null>).ref_code,
            metadata: resolvedMeta,
          };

          // Build diagnostic result Flex card showing their answers
          const entries = Object.entries(submissionData as Record<string, unknown>);
          const answerRows = entries.map(([key, value]) => {
            const field = form.fields ? (JSON.parse(form.fields) as Array<{ name: string; label: string }>).find((f: { name: string }) => f.name === key) : null;
            const label = field?.label || key;
            const val = Array.isArray(value) ? value.join(', ') : (value !== null && value !== undefined && value !== '') ? String(value) : '-';
            return {
              type: 'box' as const, layout: 'vertical' as const, margin: 'md' as const,
              contents: [
                { type: 'text' as const, text: label, size: 'xxs' as const, color: '#64748b' },
                { type: 'text' as const, text: val, size: 'sm' as const, color: '#1e293b', weight: 'bold' as const, wrap: true },
              ],
            };
          });

          const resultFlex = {
            type: 'bubble', size: 'giga',
            header: {
              type: 'box', layout: 'vertical',
              contents: [
                { type: 'text', text: '診断結果', size: 'lg', weight: 'bold', color: '#1e293b' },
                { type: 'text', text: `${friend.display_name || ''}さんの回答`, size: 'xs', color: '#64748b', margin: 'sm' },
              ],
              paddingAll: '20px', backgroundColor: '#f0fdf4',
            },
            body: {
              type: 'box', layout: 'vertical',
              contents: [
                ...answerRows,
                { type: 'separator', margin: 'lg' },
                { type: 'text', text: '他社サービスでは、フォームの回答内容に合わせたリアルタイム返信はできません。LINE Harnessだからこそ可能な体験です。', size: 'xs', color: '#06C755', weight: 'bold', wrap: true, margin: 'lg' },
              ],
              paddingAll: '20px',
            },
          };

          const messages: ReturnType<typeof buildMessage>[] = [];

          const { buildRewardMessage } = await import('../services/reward-message.js');
          const rewardFromTrackedLink = buildRewardMessage(rewardTemplate, friend.display_name);

          if (rewardFromTrackedLink) {
            // Tracked-link reward template overrides everything (per-campaign reward)
            messages.push(rewardFromTrackedLink as ReturnType<typeof buildMessage>);
          } else if (form.id === MONEY_DIAGNOSIS_FORM_ID) {
            const diagnosis = classifyMoneyDiagnosis(submissionData);
            messages.push(buildMessage('flex', JSON.stringify(buildMoneyDiagnosisFlex(friend.display_name, diagnosis))));
          } else if (form.on_submit_message_type && form.on_submit_message_content) {
            // Custom form message replaces default diagnostic result
            const expanded = expandVariables(form.on_submit_message_content, friendData, apiOrigin, form.on_submit_message_type);
            messages.push(buildMessage(form.on_submit_message_type, expanded));
          } else {
            // Default: send diagnostic result Flex
            messages.push(buildMessage('flex', JSON.stringify(resultFlex)));
          }

          await lineClient.pushMessage(friend.line_user_id, messages);

          // Mirror every pushed message into messages_log so the dashboard chat
          // view stays consistent with what the user actually receives in LINE.
          // Without this the form's auto-reply is invisible to operators.
          const { messageToLogPayload } = await import('../services/step-delivery.js');
          const sentAt = jstNow();
          for (const m of messages) {
            const payload = messageToLogPayload(m);
            await db
              .prepare(
                `INSERT INTO messages_log (id, friend_id, direction, message_type, content, broadcast_id, scenario_step_id, source, created_at)
                 VALUES (?, ?, 'outgoing', ?, ?, NULL, NULL, 'auto_reply', ?)`,
              )
              .bind(crypto.randomUUID(), friend.id, payload.messageType, payload.content, sentAt)
              .run();
          }
        })(),
      );

      if (sideEffects.length > 0) {
        const results = await Promise.allSettled(sideEffects);
        for (const r of results) {
          if (r.status === 'rejected') console.error('Form side-effect failed:', r.reason);
        }
      }
    }

    return c.json({ success: true, data: serializeSubmission(submission) }, 201);
  } catch (err) {
    console.error('POST /api/forms/:id/submit error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

async function callFormWebhook(
  form: DbForm,
  submissionData: Record<string, unknown>,
): Promise<{ passed: boolean; data: unknown }> {
  if (!form.on_submit_webhook_url) return { passed: true, data: null };

  try {
    // Replace {field_name} placeholders in URL with submitted values
    let url = form.on_submit_webhook_url;
    for (const [key, value] of Object.entries(submissionData)) {
      url = url.replace(`{${key}}`, encodeURIComponent(String(value ?? '')));
    }

    // Parse headers
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (form.on_submit_webhook_headers) {
      try {
        const parsed = JSON.parse(form.on_submit_webhook_headers) as Record<string, string>;
        Object.assign(headers, parsed);
      } catch { /* ignore invalid headers */ }
    }

    // Determine method: GET if URL has {placeholders} replaced, POST otherwise
    const isGet = form.on_submit_webhook_url.includes('{');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      method: isGet ? 'GET' : 'POST',
      headers,
      signal: controller.signal,
      ...(isGet ? {} : { body: JSON.stringify(submissionData) }),
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return { passed: false, data: { error: `HTTP ${res.status}` } };
    }

    const data = await res.json() as Record<string, unknown>;

    // Check for eligibility — support both { eligible: bool } and { success: bool, data: { eligible: bool } }
    const eligible = data.eligible ?? (data.data as Record<string, unknown> | undefined)?.eligible ?? data.success;
    return { passed: Boolean(eligible), data };
  } catch (err) {
    console.error('Form webhook error:', err);
    return { passed: false, data: { error: String(err) } };
  }
}

export { forms };

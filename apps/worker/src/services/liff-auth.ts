// LIFF id_token verification.
// Mirrors the helper in routes/booking.ts but lives in services/ so that new
// route modules (e.g. events.ts) can import & share it. booking.ts keeps its
// own copy for now to avoid touching production-stable code in this PR.

import { getLineAccounts } from '@line-crm/db';

export interface VerifyEnv {
  LINE_LOGIN_CHANNEL_ID?: string;
  DB: D1Database;
}

export interface VerifiedLineIdentity {
  lineUserId: string;
  loginChannelId: string;
  lineAccountId: string | null;
}

export async function verifyCallerLineIdentity(
  authHeader: string | undefined,
  env: VerifyEnv,
): Promise<VerifiedLineIdentity | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const idToken = authHeader.slice('Bearer '.length).trim();
  if (!idToken) return null;

  const candidates: string[] = [];
  const accountIdByChannelId = new Map<string, string>();
  const push = (channelId: string | null | undefined, lineAccountId?: string | null) => {
    if (!channelId) return;
    if (!candidates.includes(channelId)) candidates.push(channelId);
    if (lineAccountId) accountIdByChannelId.set(channelId, lineAccountId);
  };

  push(env.LINE_LOGIN_CHANNEL_ID);
  const dbAccounts = await getLineAccounts(env.DB);
  for (const a of dbAccounts) {
    const account = a as unknown as {
      id?: string | null;
      login_channel_id?: string | null;
      channel_id?: string | null;
      liff_id?: string | null;
    };
    push(account.login_channel_id, account.id);
    push(account.channel_id, account.id);
    push(account.liff_id?.split('-')[0], account.id);
  }

  try {
    const parts = idToken.split('.');
    if (parts.length === 3) {
      const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
      const payload = JSON.parse(atob(padded)) as { aud?: string | string[] };
      if (typeof payload.aud === 'string') {
        push(payload.aud);
      } else if (Array.isArray(payload.aud)) {
        for (const aud of payload.aud) push(String(aud));
      }
    }
  } catch {
    // Ignore malformed JWT payloads; LINE verify remains authoritative.
  }

  for (const channelId of candidates) {
    const res = await fetch('https://api.line.me/oauth2/v2.1/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ id_token: idToken, client_id: channelId }),
    });
    if (res.ok) {
      const verified = (await res.json()) as { sub?: string };
      if (!verified.sub) continue;
      return {
        lineUserId: verified.sub,
        loginChannelId: channelId,
        lineAccountId: accountIdByChannelId.get(channelId) ?? null,
      };
    }
  }
  return null;
}

export async function verifyCallerLineUserId(
  authHeader: string | undefined,
  env: VerifyEnv,
): Promise<string | null> {
  const identity = await verifyCallerLineIdentity(authHeader, env);
  return identity?.lineUserId ?? null;
}

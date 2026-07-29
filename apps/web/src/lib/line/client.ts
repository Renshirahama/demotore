import crypto from "node:crypto";

const LINE_API_BASE = "https://api.line.me/v2/bot";

export type LineMessage = Record<string, unknown>;

export function verifyLineSignature(rawBody: string, signature: string | null) {
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  if (!channelSecret || !signature) return false;

  const digest = crypto.createHmac("sha256", channelSecret).update(rawBody).digest("base64");
  const digestBuffer = Buffer.from(digest);
  const signatureBuffer = Buffer.from(signature);
  return digestBuffer.length === signatureBuffer.length && crypto.timingSafeEqual(digestBuffer, signatureBuffer);
}

async function lineFetch(path: string, init: RequestInit) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error("LINE_CHANNEL_ACCESS_TOKEN is required");

  return fetch(`${LINE_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

export async function replyLineMessage(replyToken: string, messages: LineMessage[]) {
  const response = await lineFetch("/message/reply", {
    method: "POST",
    body: JSON.stringify({ replyToken, messages }),
  });

  if (!response.ok) {
    throw new Error(`LINE reply failed: ${response.status} ${await response.text()}`);
  }
}

export async function pushLineMessage(lineUserId: string, messages: LineMessage[]) {
  return lineFetch("/message/push", {
    method: "POST",
    body: JSON.stringify({ to: lineUserId, messages }),
  });
}

export async function multicastLineMessage(lineUserIds: string[], messages: LineMessage[]) {
  return lineFetch("/message/multicast", {
    method: "POST",
    body: JSON.stringify({ to: lineUserIds, messages }),
  });
}

export async function sendWithBackoff(send: () => Promise<Response>, maxAttempts = 4) {
  let lastResponse: Response | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await send();
    lastResponse = response;

    if (response.status !== 429 && response.status < 500) {
      return response;
    }

    const retryAfter = Number(response.headers.get("retry-after"));
    const delayMs = Number.isFinite(retryAfter)
      ? retryAfter * 1000
      : Math.min(8000, 500 * 2 ** attempt);

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  return lastResponse;
}

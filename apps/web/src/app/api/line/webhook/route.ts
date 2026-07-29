import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { replyLineMessage, verifyLineSignature } from "@/lib/line/client";
import { createTextMessage } from "@/lib/line/flex";
import { hashLineLinkToken } from "@/lib/line/link-token";

type LineWebhookEvent = {
  type: string;
  webhookEventId?: string;
  replyToken?: string;
  source?: {
    userId?: string;
  };
  message?: {
    type?: string;
    text?: string;
  };
};

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!verifyLineSignature(rawBody, request.headers.get("x-line-signature"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const payload = JSON.parse(rawBody) as { events?: LineWebhookEvent[] };
  const supabase = createSupabaseAdmin();

  for (const event of payload.events ?? []) {
    const eventId = event.webhookEventId;
    if (eventId) {
      const { error } = await supabase.from("line_message_logs").insert({
        webhook_event_id: eventId,
        line_user_id: event.source?.userId ?? null,
        direction: "inbound",
        status: "received",
        request_body: event,
      });

      if (error?.code === "23505") continue;
      if (error) throw error;
    }

    if (event.type === "follow" && event.source?.userId) {
      await supabase
        .from("line_links")
        .update({
          status: "active",
          last_followed_at: new Date().toISOString(),
          blocked_at: null,
        })
        .eq("line_user_id", event.source.userId);
      continue;
    }

    if (event.type === "unfollow" && event.source?.userId) {
      await supabase
        .from("line_links")
        .update({
          status: "blocked",
          blocked_at: new Date().toISOString(),
        })
        .eq("line_user_id", event.source.userId);
      continue;
    }

    if (event.type === "message" && event.message?.type === "text") {
      await handleTextMessage(event);
    }
  }

  return NextResponse.json({ success: true });
}

async function handleTextMessage(event: LineWebhookEvent) {
  const lineUserId = event.source?.userId;
  const replyToken = event.replyToken;
  const text = event.message?.text?.trim() ?? "";
  if (!lineUserId || !replyToken) return;

  const token = extractLinkToken(text);
  if (!token) return;

  const supabase = createSupabaseAdmin();
  const tokenHash = hashLineLinkToken(token);
  const now = new Date().toISOString();

  const { data: link, error } = await supabase
    .from("line_links")
    .select("id, profile_id")
    .eq("link_token_hash", tokenHash)
    .is("link_token_consumed_at", null)
    .gt("link_token_expires_at", now)
    .maybeSingle();

  if (error) throw error;

  if (!link) {
    await replyLineMessage(replyToken, [
      createTextMessage("連携コードが無効、または有効期限が切れています。サイトから連携コードを再発行してください。"),
    ]);
    return;
  }

  await supabase
    .from("line_links")
    .update({
      line_user_id: lineUserId,
      status: "active",
      linked_at: now,
      last_followed_at: now,
      blocked_at: null,
      link_token_consumed_at: now,
    })
    .eq("id", link.id);

  await supabase.from("line_notification_settings").upsert({
    profile_id: link.profile_id,
    meeting: true,
    message: true,
    board: true,
    event: true,
    content: true,
  });

  await replyLineMessage(replyToken, [
    createTextMessage("LINE連携が完了しました。今後、面談依頼やメッセージなどの通知をLINEでお送りします。"),
  ]);
}

function extractLinkToken(text: string) {
  const match = text.match(/^(?:連携|link|\/link)\s+([A-Za-z0-9_-]{20,})$/i);
  return match?.[1] ?? null;
}

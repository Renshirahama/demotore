import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { pushLineMessage, sendWithBackoff } from "@/lib/line/client";
import { createMeetingRequestFlex, createTextMessage } from "@/lib/line/flex";

type NotificationType = "meeting" | "message" | "board" | "event" | "content";

type NotificationRow = {
  id: string;
  profile_id: string;
  type: NotificationType;
  title: string | null;
  body: string | null;
  url: string | null;
};

const notificationColumns = "id, profile_id, type, title, body, url";

export async function sendLineNotification(notificationId: string) {
  const supabase = createSupabaseAdmin();

  const { data: notificationData, error: notificationError } = await supabase
    .from("notifications")
    .select(notificationColumns)
    .eq("id", notificationId)
    .maybeSingle();

  if (notificationError) throw notificationError;
  const notification = notificationData as NotificationRow | null;
  if (!notification) return { status: "skipped", reason: "notification_not_found" };

  const { data: existingLog, error: existingLogError } = await supabase
    .from("line_message_logs")
    .select("id")
    .eq("notification_id", notification.id)
    .eq("profile_id", notification.profile_id)
    .eq("direction", "outbound")
    .eq("status", "sent")
    .maybeSingle();

  if (existingLogError) throw existingLogError;
  if (existingLog) return { status: "skipped", reason: "already_sent" };

  const { data: link, error: linkError } = await supabase
    .from("line_links")
    .select("line_user_id, status")
    .eq("profile_id", notification.profile_id)
    .eq("status", "active")
    .not("line_user_id", "is", null)
    .maybeSingle();

  if (linkError) throw linkError;
  if (!link?.line_user_id) return { status: "skipped", reason: "line_not_linked" };

  const { data: settings, error: settingsError } = await supabase
    .from("line_notification_settings")
    .select("meeting, message, board, event, content")
    .eq("profile_id", notification.profile_id)
    .maybeSingle();

  if (settingsError) throw settingsError;
  const typedSettings = settings as Record<NotificationType, boolean> | null;
  if (typedSettings && typedSettings[notification.type] === false) {
    await supabase.from("line_message_logs").insert({
      profile_id: notification.profile_id,
      line_user_id: link.line_user_id,
      notification_id: notification.id,
      notification_type: notification.type,
      direction: "outbound",
      status: "skipped",
      error_code: "setting_off",
      request_body: notification,
    });
    return { status: "skipped", reason: "setting_off" };
  }

  const title = notification.title ?? "新着通知";
  const body = notification.body ?? "REBNISE Sponsor Connectに新しい通知があります。";
  const messages =
    notification.type === "meeting"
      ? [createMeetingRequestFlex({ title, body, url: notification.url })]
      : [createTextMessage(`${title}\n\n${body}${notification.url ? `\n\n${notification.url}` : ""}`)];

  const response = await sendWithBackoff(() => pushLineMessage(link.line_user_id, messages));
  const responseText = response ? await response.text() : "";
  const ok = Boolean(response?.ok);

  await supabase.from("line_message_logs").insert({
    profile_id: notification.profile_id,
    line_user_id: link.line_user_id,
    notification_id: notification.id,
    notification_type: notification.type,
    direction: "outbound",
    status: ok ? "sent" : "failed",
    request_body: { messages },
    response_body: responseText ? safeJson(responseText) : null,
    error_code: ok ? null : String(response?.status ?? "unknown"),
    error_message: ok ? null : responseText,
    sent_at: ok ? new Date().toISOString() : null,
  });

  return { status: ok ? "sent" : "failed", lineStatus: response?.status };
}

function safeJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return { raw: value };
  }
}

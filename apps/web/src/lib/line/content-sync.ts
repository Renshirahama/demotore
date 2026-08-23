import crypto from "node:crypto";

import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { multicastLineMessage, sendWithBackoff } from "@/lib/line/client";
import { createTextMessage } from "@/lib/line/flex";

const chunkSize = 500;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ContentRow = {
  id: string;
  title: string | null;
  summary: string | null;
  url: string | null;
  published_at: string | null;
};

type LinkRow = {
  profile_id: string;
  line_user_id: string | null;
};

export type SyncLineContentUpdatesOptions = {
  contentIds?: string[];
  since?: string;
  limit?: number;
};

export type SyncLineContentUpdatesResult = {
  success: boolean;
  contents: number;
  sent: number;
  skipped: number;
  failed: number;
  errors: Array<{ contentId: string; status?: number; body: unknown }>;
  reason?: string;
};

export function buildContentLineText(content: Pick<ContentRow, "title" | "summary" | "url">) {
  return [
    "【新着コンテンツ】",
    "",
    content.title?.trim() || "新しいニュース・コラムが公開されました",
    content.summary?.trim() || null,
    content.url?.trim() || null,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function notificationIdForContent(contentId: string) {
  if (uuidPattern.test(contentId)) return contentId;

  const hash = crypto.createHash("sha1").update(`line-content:${contentId}`).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;

  const hex = hash.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function syncLineContentUpdates(
  options: SyncLineContentUpdatesOptions = {},
): Promise<SyncLineContentUpdatesResult> {
  const supabase = createSupabaseAdmin();
  const now = new Date().toISOString();

  let contentsQuery = supabase
    .from("contents")
    .select("id, title, summary, url, published_at")
    .not("published_at", "is", null)
    .lte("published_at", now)
    .order("published_at", { ascending: true });

  if (options.contentIds?.length) {
    contentsQuery = contentsQuery.in("id", options.contentIds);
  } else if (options.since) {
    contentsQuery = contentsQuery.gte("published_at", options.since);
  }

  if (options.limit && options.limit > 0) {
    contentsQuery = contentsQuery.limit(options.limit);
  }

  const { data: contentsData, error: contentsError } = await contentsQuery;
  if (contentsError) throw contentsError;

  const contents = (contentsData ?? []) as ContentRow[];
  if (contents.length === 0) {
    return { success: true, contents: 0, sent: 0, skipped: 0, failed: 0, errors: [], reason: "no_new_content" };
  }

  const { data: linksData, error: linksError } = await supabase
    .from("line_links")
    .select("line_user_id, profile_id")
    .eq("status", "active")
    .not("line_user_id", "is", null);

  if (linksError) throw linksError;

  const links = dedupeLinks((linksData ?? []) as LinkRow[]);
  const profileIds = links.map((row) => row.profile_id);
  if (profileIds.length === 0) {
    return { success: true, contents: contents.length, sent: 0, skipped: 0, failed: 0, errors: [], reason: "no_recipients" };
  }

  const { data: settingsData, error: settingsError } = await supabase
    .from("line_notification_settings")
    .select("profile_id")
    .in("profile_id", profileIds)
    .eq("content", true);

  if (settingsError) throw settingsError;

  const enabledProfileIds = new Set(((settingsData ?? []) as Array<{ profile_id: string }>).map((row) => row.profile_id));
  const enabledLinks = links.filter((row) => enabledProfileIds.has(row.profile_id));
  if (enabledLinks.length === 0) {
    return { success: true, contents: contents.length, sent: 0, skipped: 0, failed: 0, errors: [], reason: "content_setting_off" };
  }

  const result: SyncLineContentUpdatesResult = {
    success: true,
    contents: contents.length,
    sent: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  for (const content of contents) {
    const notificationId = notificationIdForContent(String(content.id));
    const { data: sentLogsData, error: sentLogsError } = await supabase
      .from("line_message_logs")
      .select("profile_id")
      .eq("notification_id", notificationId)
      .eq("notification_type", "content")
      .eq("direction", "outbound")
      .eq("status", "sent")
      .in("profile_id", enabledLinks.map((row) => row.profile_id));

    if (sentLogsError) throw sentLogsError;

    const alreadySentProfileIds = new Set(((sentLogsData ?? []) as Array<{ profile_id: string }>).map((row) => row.profile_id));
    const unsentLinks = enabledLinks.filter((row) => !alreadySentProfileIds.has(row.profile_id));
    result.skipped += enabledLinks.length - unsentLinks.length;

    for (let i = 0; i < unsentLinks.length; i += chunkSize) {
      const chunk = unsentLinks.slice(i, i + chunkSize);
      const messages = [createTextMessage(buildContentLineText(content))];
      const response = await sendWithBackoff(() =>
        multicastLineMessage(
          chunk.map((row) => row.line_user_id).filter(Boolean) as string[],
          messages,
        ),
      );
      const responseText = response ? await response.text() : "";
      const responseBody = responseText ? safeJson(responseText) : null;
      const ok = Boolean(response?.ok);

      const { error: logError } = await supabase.from("line_message_logs").insert(
        chunk.map((row) => ({
          profile_id: row.profile_id,
          line_user_id: row.line_user_id,
          notification_id: notificationId,
          notification_type: "content",
          direction: "outbound",
          status: ok ? "sent" : "failed",
          request_body: { content_id: content.id, messages },
          response_body: responseBody,
          error_code: ok ? null : String(response?.status ?? "unknown"),
          error_message: ok ? null : responseText,
          sent_at: ok ? new Date().toISOString() : null,
        })),
      );

      if (logError && logError.code !== "23505") throw logError;

      if (ok) {
        result.sent += chunk.length;
      } else {
        result.success = false;
        result.failed += chunk.length;
        result.errors.push({ contentId: content.id, status: response?.status, body: responseBody ?? responseText });
      }
    }
  }

  return result;
}

function dedupeLinks(links: LinkRow[]) {
  const seenProfileIds = new Set<string>();
  const deduped: LinkRow[] = [];

  for (const link of links) {
    if (!link.line_user_id || seenProfileIds.has(link.profile_id)) continue;
    seenProfileIds.add(link.profile_id);
    deduped.push(link);
  }

  return deduped;
}

function safeJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return { raw: value };
  }
}

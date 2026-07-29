import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { multicastLineMessage, sendWithBackoff } from "@/lib/line/client";

const chunkSize = 500;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || new URL(request.url).searchParams.get("secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdmin();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: contents, error: contentsError } = await supabase
    .from("contents")
    .select("id, title, summary, url, published_at")
    .gte("published_at", since)
    .order("published_at", { ascending: false })
    .limit(5);

  if (contentsError) throw contentsError;
  if (!contents?.length) return NextResponse.json({ success: true, sent: 0, reason: "no_new_content" });

  const { data: links, error: linksError } = await supabase
    .from("line_links")
    .select("line_user_id, profile_id")
    .eq("status", "active")
    .not("line_user_id", "is", null);

  if (linksError) throw linksError;

  const profileIds = (links ?? []).map((row) => row.profile_id);
  if (profileIds.length === 0) return NextResponse.json({ success: true, sent: 0, reason: "no_recipients" });

  const { data: enabledSettings, error: settingsError } = await supabase
    .from("line_notification_settings")
    .select("profile_id")
    .in("profile_id", profileIds)
    .eq("content", true);

  if (settingsError) throw settingsError;

  const enabledProfileIds = new Set((enabledSettings ?? []).map((row) => row.profile_id));
  const lineUserIds = [
    ...new Set(
      (links ?? [])
        .filter((row) => enabledProfileIds.has(row.profile_id))
        .map((row) => row.line_user_id)
        .filter(Boolean),
    ),
  ] as string[];
  const message = {
    type: "text",
    text: [
      "【REBNISE Sponsor Connect 週次ダイジェスト】",
      "",
      ...contents.map((content, index) =>
        [`${index + 1}. ${content.title}`, content.summary, content.url].filter(Boolean).join("\n"),
      ),
    ].join("\n\n"),
  };

  let sent = 0;
  const errors = [];

  for (let i = 0; i < lineUserIds.length; i += chunkSize) {
    const chunk = lineUserIds.slice(i, i + chunkSize);
    const response = await sendWithBackoff(() => multicastLineMessage(chunk, [message]));
    const responseText = response ? await response.text() : "";

    if (response?.ok) {
      sent += chunk.length;
    } else {
      errors.push({ status: response?.status, body: responseText });
    }
  }

  return NextResponse.json({ success: errors.length === 0, sent, errors });
}

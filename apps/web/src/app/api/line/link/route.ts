import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentProfileId } from "@/lib/supabase/server";
import { createOneTimeToken, hashLineLinkToken } from "@/lib/line/link-token";

async function createLineLinkToken() {
  const profileId = await getCurrentProfileId();
  if (!profileId) {
    return null;
  }

  const token = createOneTimeToken();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const supabase = createSupabaseAdmin();

  const { error } = await supabase.from("line_links").upsert(
    {
      profile_id: profileId,
      status: "active",
      link_token_hash: hashLineLinkToken(token),
      link_token_expires_at: expiresAt,
      link_token_consumed_at: null,
    },
    { onConflict: "profile_id" },
  );

  if (error) throw error;

  return {
    token,
    expiresAt,
    messageText: `連携 ${token}`,
    lineAddUrl: process.env.LINE_OFFICIAL_ACCOUNT_URL ?? null,
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET() {
  const result = await createLineLinkToken();
  if (!result) {
    return new NextResponse("ログインが必要です。", {
      status: 401,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const lineLink = result.lineAddUrl
    ? `<a class="button" href="${escapeHtml(result.lineAddUrl)}">LINEを開く</a>`
    : "";

  return new NextResponse(
    `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>LINE連携</title>
  <style>
    body { margin: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Hiragino Sans", sans-serif; background: #f6f7f9; color: #111827; }
    main { max-width: 520px; margin: 0 auto; padding: 40px 20px; }
    section { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; }
    h1 { font-size: 22px; margin: 0 0 16px; }
    p { font-size: 14px; line-height: 1.8; margin: 12px 0; color: #374151; }
    code { display: block; margin: 16px 0; padding: 14px; border-radius: 8px; background: #f3f4f6; color: #111827; word-break: break-all; font-size: 15px; }
    .button { display: block; margin-top: 18px; padding: 13px 16px; border-radius: 8px; background: #06c755; color: #fff; text-align: center; text-decoration: none; font-weight: 700; }
    .note { color: #6b7280; font-size: 13px; }
  </style>
</head>
<body>
  <main>
    <section>
      <h1>LINE連携</h1>
      <p>公式LINEを開いて、下の連携コードをそのまま送信してください。</p>
      <code>${escapeHtml(result.messageText)}</code>
      ${lineLink}
      <p class="note">このコードの有効期限は10分です。</p>
    </section>
  </main>
</body>
</html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export async function POST() {
  const result = await createLineLinkToken();
  if (!result) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    token: result.token,
    expiresAt: result.expiresAt,
    messageText: result.messageText,
    lineAddUrl: result.lineAddUrl,
  });
}

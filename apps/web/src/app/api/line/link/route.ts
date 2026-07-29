import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentProfileId } from "@/lib/supabase/server";
import { createOneTimeToken, hashLineLinkToken } from "@/lib/line/link-token";

export async function POST() {
  const profileId = await getCurrentProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  return NextResponse.json({
    token,
    expiresAt,
    messageText: `連携 ${token}`,
    lineAddUrl: process.env.LINE_OFFICIAL_ACCOUNT_URL ?? null,
  });
}

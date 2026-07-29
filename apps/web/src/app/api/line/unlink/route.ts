import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentProfileId } from "@/lib/supabase/server";

export async function POST() {
  const profileId = await getCurrentProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdmin();
  const { error } = await supabase
    .from("line_links")
    .update({
      line_user_id: null,
      link_token_hash: null,
      link_token_expires_at: null,
      link_token_consumed_at: null,
      linked_at: null,
    })
    .eq("profile_id", profileId);

  if (error) throw error;
  return NextResponse.json({ success: true });
}

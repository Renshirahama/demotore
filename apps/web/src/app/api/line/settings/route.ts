import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentProfileId } from "@/lib/supabase/server";

const keys = ["meeting", "message", "board", "event", "content"] as const;
type SettingKey = (typeof keys)[number];
type Settings = Record<SettingKey, boolean>;

const defaultSettings: Settings = {
  meeting: true,
  message: true,
  board: true,
  event: true,
  content: true,
};

export async function GET() {
  const profileId = await getCurrentProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("line_notification_settings")
    .select("meeting, message, board, event, content")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error) throw error;
  return NextResponse.json((data as Settings | null) ?? defaultSettings);
}

export async function PUT(request: Request) {
  const profileId = await getCurrentProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const settings = keys.reduce<Partial<Settings>>((acc, key) => {
    if (typeof body[key] === "boolean") acc[key] = body[key];
    return acc;
  }, {});

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("line_notification_settings")
    .upsert({ profile_id: profileId, ...defaultSettings, ...settings }, { onConflict: "profile_id" })
    .select("meeting, message, board, event, content")
    .single();

  if (error) throw error;
  return NextResponse.json(data as Settings);
}

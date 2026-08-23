import { NextResponse } from "next/server";
import { syncLineContentUpdates } from "@/lib/line/content-sync";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || new URL(request.url).searchParams.get("secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const result = await syncLineContentUpdates({ since });
  return NextResponse.json(result, { status: result.success ? 200 : 207 });
}

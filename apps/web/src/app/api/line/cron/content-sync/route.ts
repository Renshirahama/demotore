import { NextResponse } from "next/server";

import { syncLineContentUpdates } from "@/lib/line/content-sync";

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const since = url.searchParams.get("since") ?? undefined;
  const limit = parseLimit(url.searchParams.get("limit"));

  const result = await syncLineContentUpdates({ since, limit });
  return NextResponse.json(result, { status: result.success ? 200 : 207 });
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await readJson(request);
  const contentIds = Array.isArray(body.contentIds) ? body.contentIds.map(String).filter(Boolean) : undefined;
  const since = typeof body.since === "string" ? body.since : undefined;
  const limit = typeof body.limit === "number" ? body.limit : undefined;

  const result = await syncLineContentUpdates({ contentIds, since, limit });
  return NextResponse.json(result, { status: result.success ? 200 : 207 });
}

function isAuthorized(request: Request) {
  const url = new URL(request.url);
  const cronSecret = process.env.CRON_SECRET;
  const internalSecret = process.env.INTERNAL_NOTIFY_SECRET;

  return Boolean(
    (cronSecret && url.searchParams.get("secret") === cronSecret) ||
      (internalSecret && request.headers.get("x-internal-secret") === internalSecret),
  );
}

function parseLimit(value: string | null) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

async function readJson(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

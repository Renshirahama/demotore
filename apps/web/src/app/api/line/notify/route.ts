import { NextResponse } from "next/server";
import { sendLineNotification } from "@/lib/line/notifications";

export async function POST(request: Request) {
  const secret = process.env.INTERNAL_NOTIFY_SECRET;
  if (!secret || request.headers.get("x-internal-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const notificationIds = Array.isArray(body.notificationIds)
    ? body.notificationIds
    : body.notificationId
      ? [body.notificationId]
      : [];

  if (notificationIds.length === 0) {
    return NextResponse.json({ error: "notificationId is required" }, { status: 400 });
  }

  const results = [];
  for (const notificationId of notificationIds) {
    results.push({
      notificationId,
      result: await sendLineNotification(notificationId),
    });
  }

  return NextResponse.json({ success: true, results });
}

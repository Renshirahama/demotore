const baseUrl = process.env.APP_BASE_URL;
const secret = process.env.INTERNAL_NOTIFY_SECRET || process.env.CRON_SECRET;

const args = parseArgs(process.argv.slice(2));
const contentId = args.get("content-id");

if (!baseUrl || !secret) {
  throw new Error("APP_BASE_URL and INTERNAL_NOTIFY_SECRET or CRON_SECRET are required");
}

if (!contentId) {
  throw new Error("Pass --content-id=<published-content-id>");
}

async function main() {
  const first = await syncOnce(contentId);
  const second = await syncOnce(contentId);

  if (!first.success || !second.success) {
    throw new Error(`LINE content sync smoke failed: ${JSON.stringify({ first, second })}`);
  }

  if (second.sent !== 0) {
    throw new Error(`Duplicate send guard failed: second run sent ${second.sent} message(s)`);
  }

  console.log(
    JSON.stringify(
      {
        success: true,
        first,
        second,
        duplicateGuard: "ok",
      },
      null,
      2,
    ),
  );
}

async function syncOnce(id: string) {
  const response = await fetch(`${baseUrl!.replace(/\/$/, "")}/api/line/cron/content-sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": secret!,
    },
    body: JSON.stringify({ contentIds: [id] }),
  });
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`LINE content sync failed: ${response.status} ${body}`);
  }

  return JSON.parse(body) as { success: boolean; sent: number; skipped: number; failed: number };
}

function parseArgs(values: string[]) {
  const parsed = new Map<string, string>();

  for (const value of values) {
    if (!value.startsWith("--")) continue;
    const [key, ...valueParts] = value.slice(2).split("=");
    parsed.set(key, valueParts.length ? valueParts.join("=") : "true");
  }

  return parsed;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

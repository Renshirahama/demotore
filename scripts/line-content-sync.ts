const baseUrl = process.env.APP_BASE_URL;
const secret = process.env.INTERNAL_NOTIFY_SECRET || process.env.CRON_SECRET;

if (!baseUrl || !secret) {
  throw new Error("APP_BASE_URL and INTERNAL_NOTIFY_SECRET or CRON_SECRET are required");
}

const args = parseArgs(process.argv.slice(2));

const contentIds = args.get("content-id")
  ? args
      .get("content-id")
      ?.split(",")
      .map((id) => id.trim())
      .filter(Boolean)
  : undefined;
const since = args.get("since");
const limit = args.get("limit");

async function main() {
  const url = `${baseUrl.replace(/\/$/, "")}/api/line/cron/content-sync`;
  const requestBody = {
    ...(contentIds?.length ? { contentIds } : {}),
    ...(since ? { since } : {}),
    ...(limit ? { limit: Number(limit) } : {}),
  };

  if (args.has("dry-run")) {
    console.log(JSON.stringify({ url, body: requestBody }, null, 2));
    return;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": secret!,
    },
    body: JSON.stringify(requestBody),
  });
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`LINE content sync failed: ${response.status} ${body}`);
  }

  console.log(body);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

function parseArgs(values: string[]) {
  const parsed = new Map<string, string>();

  for (const value of values) {
    if (!value.startsWith("--")) continue;
    const [key, ...valueParts] = value.slice(2).split("=");
    parsed.set(key, valueParts.length ? valueParts.join("=") : "true");
  }

  return parsed;
}

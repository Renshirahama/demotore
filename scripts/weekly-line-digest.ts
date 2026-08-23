const baseUrl = process.env.APP_BASE_URL;
const secret = process.env.CRON_SECRET;

if (!baseUrl || !secret) {
  throw new Error("APP_BASE_URL and CRON_SECRET are required");
}

async function main() {
  const response = await fetch(
    `${baseUrl.replace(/\/$/, "")}/api/line/cron/content-sync?secret=${encodeURIComponent(secret)}&since=${encodeURIComponent(
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    )}`,
  );
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Weekly LINE content sync failed: ${response.status} ${body}`);
  }

  console.log(body);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

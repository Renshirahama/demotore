const baseUrl = process.env.APP_BASE_URL;
const secret = process.env.CRON_SECRET;

if (!baseUrl || !secret) {
  throw new Error("APP_BASE_URL and CRON_SECRET are required");
}

async function main() {
  const response = await fetch(`${baseUrl}/api/line/cron/weekly-digest?secret=${encodeURIComponent(secret)}`);
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Weekly LINE digest failed: ${response.status} ${body}`);
  }

  console.log(body);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

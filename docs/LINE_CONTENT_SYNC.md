# LINE content sync

ニュース・コラムを公式サイト側で公開・更新した後、以下のAPIを呼ぶとLINE連携済みユーザーへ同期されます。

## CMS webhook

```sh
curl -X POST "$APP_BASE_URL/api/line/cron/content-sync" \
  -H "Content-Type: application/json" \
  -H "x-internal-secret: $INTERNAL_NOTIFY_SECRET" \
  -d '{"contentIds":["news-1"]}'
```

`contentIds` を渡すと該当コンテンツだけを同期します。渡さない場合は `since` 以降の公開済みコンテンツを同期できます。

```sh
curl -X POST "$APP_BASE_URL/api/line/cron/content-sync" \
  -H "Content-Type: application/json" \
  -H "x-internal-secret: $INTERNAL_NOTIFY_SECRET" \
  -d '{"since":"2026-08-23T00:00:00.000Z"}'
```

同じコンテンツは `line_message_logs` で送信済み判定されるため、同じユーザーへ二重送信されません。

## Local command

```sh
pnpm line:content-sync -- --content-id=news-1
pnpm line:content-sync -- --since=2026-08-23T00:00:00.000Z
```

送信せずにリクエスト内容だけ確認する場合:

```sh
pnpm line:content-sync -- --content-id=news-1 --dry-run
```

## Production smoke test

本番で1件だけ送信し、同じコンテンツが2回目に二重送信されないことを確認します。

```sh
pnpm line:content-sync:smoke -- --content-id=news-1
```

`first.sent` が初回送信数、`second.sent` が2回目の送信数です。`second.sent` は `0` である必要があります。

必要な環境変数:

- `APP_BASE_URL`
- `INTERNAL_NOTIFY_SECRET`
- `CRON_SECRET` fallback

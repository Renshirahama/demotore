# REBNISE Sponsor LINE

Current rich menu: `rebnise-two-button-compact-v3`

Default rich menu ID at the time of setup:

```text
richmenu-64a9e2498f3dd89c711892f9866211a9
```

The menu uses `assets/rich-menus/rebnise-two-button-compact-menu.png`.

## Areas

| Label | Action |
| --- | --- |
| 公式サイト | `https://www.rebnise.jp/` |
| お問い合わせ | `https://www.rebnise.jp/inquiry/?utm_source=line&utm_medium=richmenu&utm_campaign=sponsor_official_line` |

## Notes

- The LINE account is `鹿児島レブナイズ（スポンサー様専用）`.
- The inquiry URL uses UTM parameters so inquiries can be identified as traffic from the sponsor LINE rich menu.
- Regenerate the LINE channel access token after manual API work if the token was shared in chat or logs.

## Content notifications

レブナイズサイトのニュース、コラム、投稿ページをLINE通知するには、公開コンテンツが `contents` テーブルに保存されている必要があります。

CMS側から公開イベントを送れる場合は、以下のAPIを呼びます。ニュース、コラム、固定ページ、スポンサー向け投稿など、公開時にこのAPIへ同じ形式で送ればLINE通知対象になります。

```sh
curl -X POST "$APP_BASE_URL/api/line/content-published" \
  -H "Content-Type: application/json" \
  -H "x-internal-secret: $INTERNAL_NOTIFY_SECRET" \
  -d '{
    "id": "rebnise-news-123",
    "title": "新しいお知らせのタイトル",
    "summary": "お知らせ本文の短い要約",
    "url": "https://www.rebnise.jp/news/detail/id=123",
    "publishedAt": "2026-08-28T00:00:00.000Z"
  }'
```

複数件をまとめて送る場合:

```sh
curl -X POST "$APP_BASE_URL/api/line/content-published" \
  -H "Content-Type: application/json" \
  -H "x-internal-secret: $INTERNAL_NOTIFY_SECRET" \
  -d '{
    "contents": [
      {
        "id": "column-1",
        "title": "新着コラム",
        "summary": "コラムの要約",
        "url": "https://kagoshima.rebnise.jp/column/example",
        "publishedAt": "2026-08-28T00:00:00.000Z"
      }
    ]
  }'
```

投稿公開後に以下を呼ぶと、LINE連携済みかつ `content = true` のユーザーへ「新着のお知らせ」として送信されます。同じ `content_id` は `line_message_logs` で送信済み判定するため、同じユーザーへ二重送信されません。

```sh
curl -X POST "$APP_BASE_URL/api/line/cron/content-sync" \
  -H "Content-Type: application/json" \
  -H "x-internal-secret: $INTERNAL_NOTIFY_SECRET" \
  -d '{"contentIds":["CONTENT_ID"]}'
```

差分同期する場合:

```sh
curl -X POST "$APP_BASE_URL/api/line/cron/content-sync" \
  -H "Content-Type: application/json" \
  -H "x-internal-secret: $INTERNAL_NOTIFY_SECRET" \
  -d '{"since":"2026-08-28T00:00:00.000Z"}'
```

手動確認:

```sh
APP_BASE_URL="https://your-site.example" \
INTERNAL_NOTIFY_SECRET="..." \
tsx scripts/line-content-sync.ts -- --content-id=CONTENT_ID --dry-run
```

公開通知APIの手動確認:

```sh
APP_BASE_URL="https://your-site.example" \
INTERNAL_NOTIFY_SECRET="..." \
tsx scripts/line-content-published.ts -- \
  --id=test-column-1 \
  --title="テスト投稿" \
  --summary="LINE通知のテストです" \
  --url="https://kagoshima.rebnise.jp/column/test-column-1"
```

注意: CMS側の投稿作成/公開処理から `content-published` API が呼ばれていない場合、「投稿があったら自動でお知らせ」は発火しません。ニュース、コラム、その他投稿ページをすべて対象にするには、それぞれの公開イベントからこのAPIへ投稿情報を送ります。

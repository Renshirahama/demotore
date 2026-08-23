import { describe, expect, it } from "vitest";

import { buildContentLineText, notificationIdForContent } from "./content-sync";

describe("buildContentLineText", () => {
  it("formats content updates for LINE", () => {
    expect(
      buildContentLineText({
        title: "スポンサー募集のお知らせ",
        summary: "新しいコラムを公開しました。",
        url: "https://example.com/news/1",
      }),
    ).toBe("【新着コンテンツ】\n\nスポンサー募集のお知らせ\n\n新しいコラムを公開しました。\n\nhttps://example.com/news/1");
  });

  it("falls back when title is blank", () => {
    expect(buildContentLineText({ title: " ", summary: null, url: null })).toBe(
      "【新着コンテンツ】\n\n新しいニュース・コラムが公開されました",
    );
  });
});

describe("notificationIdForContent", () => {
  it("keeps existing uuids", () => {
    const uuid = "123e4567-e89b-12d3-a456-426614174000";
    expect(notificationIdForContent(uuid)).toBe(uuid);
  });

  it("creates a stable uuid for non-uuid content ids", () => {
    const generated = notificationIdForContent("news-2026-08-23");
    expect(generated).toBe(notificationIdForContent("news-2026-08-23"));
    expect(generated).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

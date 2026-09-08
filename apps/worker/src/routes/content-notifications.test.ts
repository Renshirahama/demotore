import { describe, expect, it } from 'vitest';
import { parseRebniseFeedEntries } from './content-notifications.js';

describe('parseRebniseFeedEntries', () => {
  it('parses RSS/RDF item entries used by RSS.rdf', () => {
    const entries = parseRebniseFeedEntries(`
      <rdf:RDF>
        <item>
          <title><![CDATA[新しいニュース]]></title>
          <link>https://www.rebnise.jp/news/123</link>
          <description><![CDATA[ニュースの概要]]></description>
          <dc:date>2026-09-08T01:00:00Z</dc:date>
        </item>
      </rdf:RDF>
    `);

    expect(entries).toEqual([
      {
        id: 'https://www.rebnise.jp/news/123',
        title: '新しいニュース',
        summary: 'ニュースの概要',
        url: 'https://www.rebnise.jp/news/123',
        updatedAt: '2026-09-08T01:00:00Z',
      },
    ]);
  });

  it('keeps parsing Atom entry feeds', () => {
    const entries = parseRebniseFeedEntries(`
      <feed>
        <entry>
          <id>news-1</id>
          <title>Atomニュース</title>
          <link rel="alternate" href="https://www.rebnise.jp/news/1" />
          <summary>概要</summary>
          <updated>2026-09-08T01:00:00Z</updated>
        </entry>
      </feed>
    `);

    expect(entries[0]).toMatchObject({
      id: 'news-1',
      title: 'Atomニュース',
      summary: '概要',
      url: 'https://www.rebnise.jp/news/1',
      updatedAt: '2026-09-08T01:00:00Z',
    });
  });
});

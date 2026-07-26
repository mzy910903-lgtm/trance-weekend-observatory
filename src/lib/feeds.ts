import * as cheerio from "cheerio";

export type FeedItem = {
  title: string;
  url: string;
  publishedAt: Date | null;
  excerpt: string;
};

export type FeedScanResult = {
  title: string;
  items: FeedItem[];
  message?: string;
};

function cleanText(value?: string | null) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function absolutize(value: string | undefined, baseUrl: string) {
  if (!value) return null;

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

export async function fetchFeed(feedUrl: string): Promise<FeedScanResult> {
  const response = await fetch(feedUrl, {
    headers: {
      "user-agent":
        "TranceWeekendObservatory/0.1 (+https://tranceweekend.local)",
      accept:
        "application/rss+xml,application/atom+xml,application/xml,text/xml,*/*",
    },
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    throw new Error(`来源扫描失败：HTTP ${response.status}`);
  }

  const xml = await response.text();
  const $ = cheerio.load(xml, { xmlMode: true });
  const feedTitle =
    cleanText($("channel > title").first().text()) ||
    cleanText($("feed > title").first().text()) ||
    new URL(feedUrl).hostname.replace(/^www\./, "");

  const rssItems = $("item")
    .map((_, item) => {
      const element = $(item);
      const url = absolutize(cleanText(element.children("link").first().text()), feedUrl);
      if (!url) return null;

      return {
        title: cleanText(element.children("title").first().text()) || url,
        url,
        publishedAt: parseDate(
          cleanText(element.children("pubDate").first().text()) ||
            cleanText(element.children("dc\\:date").first().text()),
        ),
        excerpt: cleanText(
          element.children("description").first().text() ||
            element.children("content\\:encoded").first().text(),
        ).slice(0, 500),
      };
    })
    .get()
    .filter(Boolean) as FeedItem[];

  const atomItems = $("entry")
    .map((_, item) => {
      const element = $(item);
      const href =
        element.children("link[rel='alternate']").attr("href") ||
        element.children("link").first().attr("href");
      const url = absolutize(href, feedUrl);
      if (!url) return null;

      return {
        title: cleanText(element.children("title").first().text()) || url,
        url,
        publishedAt: parseDate(
          cleanText(element.children("published").first().text()) ||
            cleanText(element.children("updated").first().text()),
        ),
        excerpt: cleanText(
          element.children("summary").first().text() ||
            element.children("content").first().text(),
        ).slice(0, 500),
      };
    })
    .get()
    .filter(Boolean) as FeedItem[];

  const seen = new Set<string>();
  const items = [...rssItems, ...atomItems]
    .filter((item) => {
      if (seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    })
    .slice(0, 30);

  return { title: feedTitle, items };
}

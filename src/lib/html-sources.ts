import * as cheerio from "cheerio";
import type { FeedItem, FeedScanResult } from "@/lib/feeds";

const SOURCE_USER_AGENT =
  "TranceWeekendObservatory/0.1 (+https://tranceweekend.local)";

function cleanText(value?: string | null) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function absolutize(value: string | undefined | null, baseUrl: string) {
  if (!value) return null;

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

function titleFromSlug(url: string) {
  const pathname = new URL(url).pathname;
  const slug = pathname.split("/").filter(Boolean).pop() ?? url;
  return slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": SOURCE_USER_AGENT,
      accept: "text/html,application/xhtml+xml,*/*",
    },
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    throw new Error(`来源扫描失败：HTTP ${response.status}`);
  }

  return response.text();
}

function uniqueItems(items: FeedItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

export async function fetchRaNewsHtml(url: string): Promise<FeedScanResult> {
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  const items = uniqueItems(
    $("a[href*='/news/'], a[href*='/features/'], a[href*='/reviews/']")
      .map((_, element) => {
        const href = absolutize($(element).attr("href"), url);
        if (!href || !/\/(news|features|reviews)\/\d+/.test(href)) return null;

        const title =
          cleanText($(element).attr("aria-label")) ||
          cleanText($(element).text()) ||
          titleFromSlug(href);

        const section = new URL(href).pathname.split("/").filter(Boolean)[0] ?? "news";

        return {
          title,
          url: href,
          publishedAt: null,
          excerpt: `RA Trance ${section} candidate: ${title}`.slice(0, 500),
        };
      })
      .get()
      .filter(Boolean) as FeedItem[],
  ).slice(0, 30);

  return { title: "Resident Advisor Trance News", items };
}

const beatportalKeepPatterns = [
  /trance/i,
  /anjuna/i,
  /above\s*&\s*beyond/i,
  /armin/i,
  /ti[eë]sto/i,
  /paul\s+van\s+dyk/i,
  /ferry\s+corsten/i,
  /solarstone/i,
  /orkidea/i,
  /dreamstate/i,
  /state\s+of\s+trance/i,
  /black\s+hole/i,
  /enhanced/i,
  /progressive/i,
];

function isBeatportalArticle(url: string) {
  return /^https:\/\/www\.beatportal\.com\/articles\/\d+-/.test(url);
}

function shouldKeepBeatportalItem(item: FeedItem) {
  const text = `${item.title}\n${item.url}\n${item.excerpt}`;
  return beatportalKeepPatterns.some((pattern) => pattern.test(text));
}

export async function fetchBeatportalHtml(url: string): Promise<FeedScanResult> {
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  const items = uniqueItems(
    $("a[href*='/articles/']")
      .map((_, element) => {
        const href = absolutize($(element).attr("href"), url);
        if (!href || !isBeatportalArticle(href)) return null;

        const title =
          cleanText($(element).attr("aria-label")) ||
          cleanText($(element).text()) ||
          titleFromSlug(href);

        return {
          title,
          url: href,
          publishedAt: null,
          excerpt: `Beatportal article candidate: ${title}`.slice(0, 500),
        };
      })
      .get()
      .filter(Boolean) as FeedItem[],
  )
    .filter(shouldKeepBeatportalItem)
    .slice(0, 30);

  return { title: "Beatportal", items };
}

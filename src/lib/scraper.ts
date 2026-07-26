import * as cheerio from "cheerio";

const MAX_HTML_BYTES = 1_500_000;
const SCRAPE_TIMEOUT_MS = 10_000;
const MAX_EXCERPT_CHARS = 900;
const MAX_EXCERPT_PARAGRAPHS = 4;

export type ScrapeStatus = "SUCCESS" | "PARTIAL" | "FAILED";

export type ScrapedPage = {
  title: string;
  description: string;
  image: string | null;
  excerpt: string;
  siteName: string;
  url: string;
  canonicalUrl: string;
  author: string | null;
  publishedAt: Date | null;
  language: string | null;
  scrapeStatus: ScrapeStatus;
  scrapeMessage: string;
};

function cleanText(value?: string | null) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function absolutizeUrl(value: string | undefined | null, baseUrl: string) {
  if (!value) return null;

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function extractDomPublishedAt($: cheerio.CheerioAPI) {
  const selectors = [
    "article header time[datetime]",
    "main header time[datetime]",
    "header time[datetime]",
    "article time[datetime]",
    "main time[datetime]",
    "time[datetime]",
  ];

  for (const selector of selectors) {
    const values = $(selector)
      .map((_, element) => {
        const parentText = cleanText($(element).parent().text());
        if (/available|pre-?order|basket|cart|shipping/i.test(parentText)) {
          return null;
        }
        return $(element).attr("datetime") ?? $(element).attr("dateTime") ?? "";
      })
      .get();

    for (const value of values) {
      const date = parseDate(value);
      if (date) return date;
    }
  }

  return null;
}

function normalizeUrl(url: string) {
  const parsed = new URL(url);
  parsed.hash = "";

  for (const key of Array.from(parsed.searchParams.keys())) {
    if (/^utm_|^fbclid$|^gclid$|^mc_cid$|^mc_eid$/i.test(key)) {
      parsed.searchParams.delete(key);
    }
  }

  return parsed.toString();
}

function firstJsonLdObject($: cheerio.CheerioAPI) {
  const scripts = $("script[type='application/ld+json']")
    .map((_, element) => $(element).contents().text())
    .get();

  for (const script of scripts) {
    try {
      const parsed = JSON.parse(script);
      const values = Array.isArray(parsed) ? parsed : [parsed];
      const flattened = values.flatMap((value) =>
        Array.isArray(value?.["@graph"]) ? value["@graph"] : [value],
      );
      const article = flattened.find((value) => {
        const type = value?.["@type"];
        return Array.isArray(type)
          ? type.some((item) => /article|newsarticle|blogposting/i.test(item))
          : /article|newsarticle|blogposting/i.test(type ?? "");
      });
      if (article) return article;
    } catch {
      continue;
    }
  }

  return null;
}

function jsonLdString(value: unknown) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return jsonLdString(value[0]);
  if (typeof value === "object" && "name" in value) {
    return String((value as { name?: unknown }).name ?? "");
  }
  return "";
}

function extractParagraphs($: cheerio.CheerioAPI, selector: string) {
  return $(selector)
    .find("p")
    .map((_, element) => cleanText($(element).text()))
    .get()
    .filter((text) => text.length >= 45 && !/cookie|subscribe|newsletter|广告|隐私政策/i.test(text));
}

function scoreParagraphs(paragraphs: string[]) {
  const textLength = paragraphs.join("\n").length;
  const countBonus = Math.min(paragraphs.length, 8) * 40;
  return textLength + countBonus;
}

function clampExcerpt(value: string) {
  if (value.length <= MAX_EXCERPT_CHARS) return value;

  const sliced = value.slice(0, MAX_EXCERPT_CHARS);
  const sentenceEnd = Math.max(
    sliced.lastIndexOf("。"),
    sliced.lastIndexOf("！"),
    sliced.lastIndexOf("？"),
    sliced.lastIndexOf("."),
    sliced.lastIndexOf("!"),
    sliced.lastIndexOf("?"),
    sliced.lastIndexOf("\n"),
  );

  if (sentenceEnd >= MAX_EXCERPT_CHARS * 0.65) {
    return sliced.slice(0, sentenceEnd + 1).trim();
  }

  const wordEnd = sliced.lastIndexOf(" ");
  return `${sliced.slice(0, wordEnd > 0 ? wordEnd : MAX_EXCERPT_CHARS).trim()}…`;
}

function extractExcerpt($: cheerio.CheerioAPI) {
  $("script, style, noscript, iframe, nav, footer, aside, form").remove();

  const candidates = [
    "article",
    "main",
    "[role='main']",
    ".article",
    ".post",
    ".entry-content",
    ".content",
    "body",
  ].map((selector) => {
    const paragraphs = extractParagraphs($, selector);
    return { selector, paragraphs, score: scoreParagraphs(paragraphs) };
  });

  const best = candidates.sort((a, b) => b.score - a.score)[0];
  const excerpt = best.paragraphs
    .slice(0, MAX_EXCERPT_PARAGRAPHS)
    .join("\n")
    .trim()
    .split("\n")
    .map((paragraph) => paragraph.trim())
    .join("\n")
    .trim()
    .replace(/[\s,;:，；：-]+$/, "")
    .trim();

  return clampExcerpt(excerpt);
}

async function readLimitedHtml(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) return response.text();

  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    received += value.byteLength;
    if (received > MAX_HTML_BYTES) {
      throw new Error("抓取失败：HTML 体积过大。");
    }
    chunks.push(value);
  }

  return new TextDecoder().decode(
    new Uint8Array(chunks.flatMap((chunk) => Array.from(chunk))),
  );
}

export async function scrapePage(url: string): Promise<ScrapedPage> {
  const normalizedInputUrl = normalizeUrl(url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(normalizedInputUrl, {
      headers: {
        "user-agent":
          "TranceWeekendObservatory/0.1 (+https://tranceweekend.local)",
        accept: "text/html,application/xhtml+xml",
      },
      signal: controller.signal,
      next: { revalidate: 0 },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("抓取失败：请求超时。");
    }
    throw new Error("抓取失败：网络请求失败。");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`抓取失败：HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType && !/text\/html|application\/xhtml\+xml/i.test(contentType)) {
    throw new Error(`抓取失败：非 HTML 内容（${contentType.split(";")[0]}）。`);
  }

  const html = await readLimitedHtml(response);
  const finalUrl = normalizeUrl(response.url || normalizedInputUrl);
  const $ = cheerio.load(html);
  const jsonLd = firstJsonLdObject($);

  const canonicalUrl =
    absolutizeUrl($("link[rel='canonical']").attr("href"), finalUrl) ||
    absolutizeUrl(jsonLdString(jsonLd?.url || jsonLd?.mainEntityOfPage), finalUrl) ||
    finalUrl;

  const title =
    cleanText($("meta[property='og:title']").attr("content")) ||
    cleanText($("meta[name='twitter:title']").attr("content")) ||
    cleanText(jsonLdString(jsonLd?.headline || jsonLd?.name)) ||
    cleanText($("title").first().text()) ||
    cleanText($("h1").first().text()) ||
    "未命名资讯";

  const description =
    cleanText($("meta[name='description']").attr("content")) ||
    cleanText($("meta[property='og:description']").attr("content")) ||
    cleanText($("meta[name='twitter:description']").attr("content")) ||
    cleanText(jsonLdString(jsonLd?.description));

  const image =
    absolutizeUrl(
      $("meta[property='og:image']").attr("content") ||
        $("meta[name='twitter:image']").attr("content") ||
        jsonLdString(jsonLd?.image),
      finalUrl,
    );

  const siteName =
    cleanText($("meta[property='og:site_name']").attr("content")) ||
    cleanText(jsonLdString(jsonLd?.publisher)) ||
    new URL(finalUrl).hostname.replace(/^www\./, "");

  const author =
    cleanText($("meta[name='author']").attr("content")) ||
    cleanText(jsonLdString(jsonLd?.author)) ||
    null;

  const publishedAt =
    parseDate($("meta[property='article:published_time']").attr("content")) ||
    parseDate($("meta[name='pubdate']").attr("content")) ||
    parseDate(jsonLdString(jsonLd?.datePublished)) ||
    extractDomPublishedAt($) ||
    null;

  const language =
    cleanText($("html").attr("lang")) ||
    cleanText($("meta[property='og:locale']").attr("content")) ||
    null;

  const excerpt = extractExcerpt($);
  const scrapeStatus: ScrapeStatus = excerpt.length >= 180 ? "SUCCESS" : "PARTIAL";
  const missing = [
    image ? null : "缺少主图",
    publishedAt ? null : "缺少原文发布时间",
    excerpt.length >= 180 ? null : "正文片段不足",
  ].filter(Boolean);

  return {
    title,
    description,
    image,
    excerpt: excerpt || description || title,
    siteName,
    url: finalUrl,
    canonicalUrl: normalizeUrl(canonicalUrl),
    author,
    publishedAt,
    language,
    scrapeStatus,
    scrapeMessage:
      missing.length > 0 ? `抓取完成，但${missing.join("、")}。` : "抓取完成。",
  };
}

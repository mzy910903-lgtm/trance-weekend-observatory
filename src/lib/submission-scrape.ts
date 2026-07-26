import { prisma } from "@/lib/prisma";
import { scrapePage, type ScrapedPage } from "@/lib/scraper";

function shouldReuseScrape(submission: {
  scrapeStatus: string | null;
  rawTitle: string | null;
  rawExcerpt: string | null;
  canonicalUrl: string | null;
}) {
  return Boolean(
    (submission.scrapeStatus === "SUCCESS" ||
      submission.scrapeStatus === "PARTIAL") &&
      submission.rawTitle &&
      submission.rawExcerpt &&
      submission.canonicalUrl,
  );
}

export function scrapedPageFromSubmission(submission: {
  url: string;
  rawTitle: string | null;
  rawDescription: string | null;
  rawImage: string | null;
  rawExcerpt: string | null;
  canonicalUrl: string | null;
  rawAuthor: string | null;
  rawPublishedAt: Date | null;
  source?: { name: string } | null;
  nickname: string;
  scrapeStatus: string | null;
  scrapeMessage: string | null;
}): ScrapedPage | null {
  if (!shouldReuseScrape(submission)) return null;

  return {
    title: submission.rawTitle ?? "未命名资讯",
    description: submission.rawDescription ?? "",
    image: submission.rawImage,
    excerpt: submission.rawExcerpt ?? "",
    siteName:
      submission.source?.name ||
      submission.nickname ||
      new URL(submission.url).hostname.replace(/^www\./, ""),
    url: submission.canonicalUrl ?? submission.url,
    canonicalUrl: submission.canonicalUrl ?? submission.url,
    author: submission.rawAuthor,
    publishedAt: submission.rawPublishedAt,
    language: null,
    scrapeStatus:
      submission.scrapeStatus === "SUCCESS" ? "SUCCESS" : "PARTIAL",
    scrapeMessage: submission.scrapeMessage ?? "复用已抓取预览。",
  };
}

export async function scrapeSubmission(submissionId: string) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { source: true },
  });

  if (!submission) {
    return { ok: false, error: "投稿不存在。" };
  }

  try {
    const page = await scrapePage(submission.url);
    const duplicate = await prisma.submission.findFirst({
      where: {
        id: { not: submission.id },
        OR: [{ url: page.canonicalUrl }, { canonicalUrl: page.canonicalUrl }],
      },
      select: { id: true },
    });

    if (duplicate) {
      await prisma.submission.update({
        where: { id: submission.id },
        data: {
          canonicalUrl: page.canonicalUrl,
          scrapeStatus: "FAILED",
          scrapeMessage: "抓取成功，但 canonical URL 已存在于队列中。",
          errorMessage: "重复链接：canonical URL 已存在。",
          scrapedAt: new Date(),
        },
      });
      return { ok: false, error: "重复链接：canonical URL 已存在。" };
    }

    await prisma.submission.update({
      where: { id: submission.id },
      data: {
        canonicalUrl: page.canonicalUrl,
        rawTitle: page.title,
        rawDescription: page.description,
        rawExcerpt: page.excerpt,
        rawImage: page.image,
        rawAuthor: page.author,
        rawPublishedAt: page.publishedAt,
        scrapeStatus: page.scrapeStatus,
        scrapeMessage: page.scrapeMessage,
        scrapedAt: new Date(),
        errorMessage: null,
      },
    });

    return { ok: true, page };
  } catch (error) {
    const message = error instanceof Error ? error.message : "抓取失败。";

    await prisma.submission.update({
      where: { id: submission.id },
      data: {
        scrapeStatus: "FAILED",
        scrapeMessage: message.slice(0, 500),
        errorMessage: message.slice(0, 500),
        scrapedAt: new Date(),
      },
    });

    return { ok: false, error: message };
  }
}

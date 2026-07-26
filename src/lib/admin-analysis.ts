import { analyzeArticle, makeArticleSlug } from "@/lib/analyzer";
import { ArticleStatus, SubmissionStatus } from "@/lib/categories";
import { judgeNewsRecency } from "@/lib/news-recency";
import { prisma } from "@/lib/prisma";
import {
  scrapeSubmission,
  scrapedPageFromSubmission,
} from "@/lib/submission-scrape";

function tagSlug(name: string) {
  return name.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, "").trim().replace(/\s+/g, "-");
}

export async function analyzeSubmission(
  submissionId: string,
  options?: { maxSourceAgeDays?: number },
) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { article: true, source: true },
  });

  if (!submission) {
    return { ok: false, error: "投稿不存在。" };
  }

  let page = scrapedPageFromSubmission(submission);

  if (!page) {
    const scrapeResult = await scrapeSubmission(submission.id);
    if (!scrapeResult.ok || !scrapeResult.page) {
      return { ok: false, error: scrapeResult.error ?? "抓取失败。" };
    }
    page = scrapeResult.page;
  }

  if (page.scrapeStatus === "PARTIAL" && page.excerpt.length < 120) {
    const message = "抓取质量不足：正文片段过短，已跳过 AI 分析。";

    await prisma.submission.update({
      where: { id: submission.id },
      data: {
        status: SubmissionStatus.PENDING,
        errorMessage: message.slice(0, 500),
        scrapeMessage: message.slice(0, 500),
      },
    });

    return { ok: false, error: message };
  }

  // Some label feeds carry a publication date that the linked page omits.
  // Preserve that source date rather than replacing it with an empty value.
  const sourcePublishedAt = page.publishedAt ?? submission.rawPublishedAt;

  const recency = judgeNewsRecency(
    {
      title: page.title,
      url: page.canonicalUrl || page.url,
      rawExcerpt: page.excerpt || page.description,
      publishedAt: sourcePublishedAt,
      discoveredAt: submission.discoveredAt,
    },
    new Date(),
    options?.maxSourceAgeDays,
  );

  if (!recency.accepted) {
    await prisma.submission.update({
      where: { id: submission.id },
      data: {
        status: SubmissionStatus.REJECTED,
        rawTitle: page.title,
        rawDescription: page.description,
        rawExcerpt: page.excerpt,
        rawImage: page.image,
        rawAuthor: page.author,
        rawPublishedAt: sourcePublishedAt,
        canonicalUrl: page.canonicalUrl,
        scrapeStatus: page.scrapeStatus,
        scrapeMessage: recency.reason.slice(0, 500),
        scrapedAt: new Date(),
        errorMessage: recency.reason.slice(0, 500),
      },
    });

    return { ok: false, error: recency.reason };
  }

  let analysis;
  try {
    analysis = await analyzeArticle(page);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "AI 分析失败。";

    await prisma.submission.update({
      where: { id: submission.id },
      data: { errorMessage: message.slice(0, 500) },
    });

    return { ok: false, error: message };
  }

  const source = await prisma.source.upsert({
    where: { url: new URL(page.url).origin },
    update: { name: page.siteName },
    create: { name: page.siteName, url: new URL(page.url).origin },
  });

  await prisma.$transaction(async (tx) => {
    await tx.submission.update({
      where: { id: submission.id },
      data: {
        status: SubmissionStatus.ANALYZED,
        rawTitle: page.title,
        rawDescription: page.description,
        rawExcerpt: page.excerpt,
        rawImage: page.image,
        rawAuthor: page.author,
        rawPublishedAt: sourcePublishedAt,
        canonicalUrl: page.canonicalUrl,
        scrapeStatus: page.scrapeStatus,
        scrapeMessage: page.scrapeMessage,
        scrapedAt: new Date(),
        errorMessage: null,
      },
    });

    const article = await tx.article.upsert({
      where: { submissionId: submission.id },
      update: {
        title: analysis.title,
        summary: analysis.summary,
        fullSummary: analysis.fullSummary,
        coverImage: page.image || "/default-cover.svg",
        sourceName: page.siteName,
        sourceUrl: page.url,
        sourcePublishedAt,
        sourceId: source.id,
        category: analysis.category,
        status: ArticleStatus.DRAFT,
        importanceScore: analysis.importanceScore,
        artistryScore: analysis.artistryScore,
        humorScore: analysis.humorScore,
        scoreExplanation: analysis.scoreExplanation,
        aiComment: analysis.aiComment,
      },
      create: {
        slug: makeArticleSlug(analysis.title),
        title: analysis.title,
        summary: analysis.summary,
        fullSummary: analysis.fullSummary,
        coverImage: page.image || "/default-cover.svg",
        sourceName: page.siteName,
        sourceUrl: page.url,
        sourcePublishedAt,
        sourceId: source.id,
        submissionId: submission.id,
        category: analysis.category,
        status: ArticleStatus.DRAFT,
        importanceScore: analysis.importanceScore,
        artistryScore: analysis.artistryScore,
        humorScore: analysis.humorScore,
        scoreExplanation: analysis.scoreExplanation,
        aiComment: analysis.aiComment,
      },
    });

    await tx.articleTag.deleteMany({ where: { articleId: article.id } });

    for (const tagName of analysis.tags) {
      const normalized = tagName.trim();
      if (!normalized) continue;

      const slug = tagSlug(normalized);
      if (!slug) continue;

      const tag = await tx.tag.upsert({
        where: { slug },
        update: { name: normalized },
        create: { name: normalized, slug },
      });

      await tx.articleTag.create({
        data: { articleId: article.id, tagId: tag.id },
      });
    }
  });

  return { ok: true };
}

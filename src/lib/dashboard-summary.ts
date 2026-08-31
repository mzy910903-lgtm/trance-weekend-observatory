import { ArticleStatus, SubmissionStatus } from "@/lib/categories";
import { prisma } from "@/lib/prisma";

const dateValue = (date: Date | null) => date?.toISOString() ?? null;

export async function getDashboardSummary() {
  const [articles, submissions, sources, latestPublished, latestScan, failedSources] =
    await Promise.all([
      prisma.article.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      prisma.submission.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      prisma.source.findMany({ select: { enabled: true } }),
      prisma.article.findMany({
        where: { status: ArticleStatus.PUBLISHED },
        select: {
          title: true,
          slug: true,
          sourcePublishedAt: true,
          publishedAt: true,
        },
        orderBy: [
          { sourcePublishedAt: "desc" },
          { publishedAt: "desc" },
          { createdAt: "desc" },
        ],
        take: 3,
      }),
      prisma.source.findFirst({
        where: { lastScannedAt: { not: null } },
        select: { lastScannedAt: true },
        orderBy: { lastScannedAt: "desc" },
      }),
      prisma.source.findMany({
        where: { lastScanStatus: "FAILED" },
        select: { name: true, lastScanMessage: true, lastScannedAt: true },
        orderBy: { lastScannedAt: "desc" },
        take: 3,
      }),
    ]);

  const countByStatus = (items: { status: string; _count: { _all: number } }[]) =>
    Object.fromEntries(items.map((item) => [item.status, item._count._all]));
  const articleCounts = countByStatus(articles);
  const submissionCounts = countByStatus(submissions);

  return {
    generatedAt: new Date().toISOString(),
    articles: {
      published: articleCounts[ArticleStatus.PUBLISHED] ?? 0,
      draft: articleCounts[ArticleStatus.DRAFT] ?? 0,
      archived: articleCounts[ArticleStatus.ARCHIVED] ?? 0,
    },
    submissions: {
      pending: submissionCounts[SubmissionStatus.PENDING] ?? 0,
      analyzed: submissionCounts[SubmissionStatus.ANALYZED] ?? 0,
      published: submissionCounts[SubmissionStatus.PUBLISHED] ?? 0,
      rejected: submissionCounts[SubmissionStatus.REJECTED] ?? 0,
    },
    sources: {
      total: sources.length,
      enabled: sources.filter((source) => source.enabled).length,
      lastScannedAt: dateValue(latestScan?.lastScannedAt ?? null),
      failures: failedSources.map((source) => ({
        name: source.name,
        message: source.lastScanMessage || "扫描失败，待查看来源配置。",
        scannedAt: dateValue(source.lastScannedAt),
      })),
    },
    latestPublished: latestPublished.map((article) => ({
      title: article.title,
      slug: article.slug,
      sourcePublishedAt: dateValue(article.sourcePublishedAt),
      publishedAt: dateValue(article.publishedAt),
    })),
  };
}

import { analyzeSubmission } from "@/lib/admin-analysis";
import { ArticleStatus, SubmissionStatus } from "@/lib/categories";
import { judgeAutoDraftCandidate } from "@/lib/editorial-filter";
import { judgeNewsRecency } from "@/lib/news-recency";
import { prisma } from "@/lib/prisma";
import { scanSource } from "@/lib/source-scan";

const DEFAULT_AUTO_DRAFT_LIMIT = 20;
const MAX_AUTO_DRAFT_LIMIT = 30;
const DEFAULT_AUTO_DRAFT_MIN_CANDIDATES = 10;
const DEFAULT_DRAFT_RETENTION_DAYS = 7;

function parseAutoDraftLimit() {
  const value = Number.parseInt(process.env.AUTO_DRAFT_LIMIT ?? "", 10);
  if (Number.isNaN(value)) return DEFAULT_AUTO_DRAFT_LIMIT;
  return Math.min(Math.max(value, 1), MAX_AUTO_DRAFT_LIMIT);
}

function parseDraftRetentionDays() {
  const value = Number.parseInt(process.env.AUTO_DRAFT_RETENTION_DAYS ?? "", 10);
  if (Number.isNaN(value)) return DEFAULT_DRAFT_RETENTION_DAYS;
  return Math.min(Math.max(value, 1), 30);
}

function parseAutoDraftMinCandidates(limit: number) {
  const value = Number.parseInt(process.env.AUTO_DRAFT_MIN_CANDIDATES ?? "", 10);
  if (Number.isNaN(value)) return Math.min(DEFAULT_AUTO_DRAFT_MIN_CANDIDATES, limit);
  return Math.min(Math.max(value, 0), limit);
}

async function cleanupExpiredDrafts() {
  const retentionDays = parseDraftRetentionDays();
  const expiresBefore = new Date(
    Date.now() - retentionDays * 24 * 60 * 60 * 1000,
  );

  const expiredDrafts = await prisma.article.findMany({
    where: {
      status: ArticleStatus.DRAFT,
      publishedAt: null,
      createdAt: { lt: expiresBefore },
    },
    select: { id: true, submissionId: true },
  });

  if (expiredDrafts.length === 0) {
    return { retentionDays, archived: 0 };
  }

  await prisma.$transaction(async (tx) => {
    await tx.article.updateMany({
      where: { id: { in: expiredDrafts.map((draft) => draft.id) } },
      data: { status: ArticleStatus.ARCHIVED },
    });

    const submissionIds = expiredDrafts
      .map((draft) => draft.submissionId)
      .filter((id): id is string => Boolean(id));

    if (submissionIds.length > 0) {
      await tx.submission.updateMany({
        where: { id: { in: submissionIds } },
        data: {
          status: SubmissionStatus.REJECTED,
          errorMessage: `自动清理：草稿超过 ${retentionDays} 天未发布，已移出候选池。`,
        },
      });
    }
  });

  return { retentionDays, archived: expiredDrafts.length };
}

async function cleanupStaleDrafts() {
  const drafts = await prisma.article.findMany({
    where: {
      status: ArticleStatus.DRAFT,
      submission: { isNot: null },
    },
    select: {
      id: true,
      title: true,
      sourceUrl: true,
      summary: true,
      submissionId: true,
      submission: {
        select: {
          rawTitle: true,
          rawExcerpt: true,
          rawPublishedAt: true,
          discoveredAt: true,
          note: true,
        },
      },
    },
  });

  const staleDrafts = drafts
    .map((draft) => {
      const decision = judgeNewsRecency({
        title: draft.submission?.rawTitle || draft.title,
        url: draft.sourceUrl,
        rawExcerpt: draft.submission?.rawExcerpt || draft.summary,
        note: draft.submission?.note,
        publishedAt: draft.submission?.rawPublishedAt,
        discoveredAt: draft.submission?.discoveredAt,
      });

      return { ...draft, decision };
    })
    .filter((draft) => !draft.decision.accepted);

  if (staleDrafts.length === 0) {
    return { archived: 0 };
  }

  await prisma.$transaction(async (tx) => {
    await tx.article.updateMany({
      where: { id: { in: staleDrafts.map((draft) => draft.id) } },
      data: { status: ArticleStatus.ARCHIVED },
    });

    for (const draft of staleDrafts) {
      if (!draft.submissionId) continue;

      await tx.submission.update({
        where: { id: draft.submissionId },
        data: {
          status: SubmissionStatus.REJECTED,
          errorMessage: draft.decision.reason.slice(0, 500),
        },
      });
    }
  });

  return { archived: staleDrafts.length };
}

export async function runAutoDraft(options?: { maxSourceAgeDays?: number }) {
  const limit = parseAutoDraftLimit();
  const minCandidates = parseAutoDraftMinCandidates(limit);
  const cleanup = await cleanupExpiredDrafts();
  const staleCleanup = await cleanupStaleDrafts();
  const sources = await prisma.source.findMany({
    where: { enabled: true, feedUrl: { not: null } },
    select: { id: true, name: true },
  });

  const sourceResults = await Promise.all(
    sources.map(async (source) => ({
      source,
      result: await scanSource(source.id, options),
    })),
  );

  let created = 0;
  const sourceFailures: string[] = [];

  for (const { source, result } of sourceResults) {
    if (result.ok) {
      created += result.created;
    } else {
      sourceFailures.push(`${source.name}: ${result.error ?? "扫描失败"}`);
    }
  }

  const pendingSubmissions = await prisma.submission.findMany({
    where: {
      status: SubmissionStatus.PENDING,
      article: null,
      errorMessage: null,
    },
    select: {
      id: true,
      url: true,
      rawTitle: true,
      rawExcerpt: true,
      rawPublishedAt: true,
      discoveredAt: true,
      note: true,
      source: { select: { name: true, type: true } },
    },
    orderBy: [{ discoveredAt: "desc" }, { createdAt: "desc" }],
    take: limit * 12,
  });

  const analyzed: string[] = [];
  const skipped: { id: string; url: string; reason: string; score: number }[] = [];
  const analysisFailures: { id: string; url: string; error: string }[] = [];

  for (const submission of pendingSubmissions) {
    if (analyzed.length >= limit) break;

    const recency = judgeNewsRecency(
      {
        title: submission.rawTitle,
        url: submission.url,
        rawExcerpt: submission.rawExcerpt,
        note: submission.note,
        publishedAt: submission.rawPublishedAt,
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
          errorMessage: recency.reason.slice(0, 500),
        },
      });
      skipped.push({
        id: submission.id,
        url: submission.url,
        reason: recency.reason,
        score: -10,
      });
      continue;
    }

    const decision = judgeAutoDraftCandidate({
      title: submission.rawTitle,
      url: submission.url,
      rawExcerpt: submission.rawExcerpt,
      note: submission.note,
      publishedAt: submission.rawPublishedAt,
      source: submission.source,
    });

    if (!decision.accepted) {
      await prisma.submission.update({
        where: { id: submission.id },
        data: {
          status: SubmissionStatus.REJECTED,
          errorMessage: decision.reason.slice(0, 500),
        },
      });
      skipped.push({
        id: submission.id,
        url: submission.url,
        reason: decision.reason,
        score: decision.score,
      });
      continue;
    }

    const result = await analyzeSubmission(submission.id, options);
    if (result.ok) {
      analyzed.push(submission.id);
    } else {
      analysisFailures.push({
        id: submission.id,
        url: submission.url,
        error: result.error ?? "分析失败。",
      });
    }
  }

  return {
    ok: sourceFailures.length === 0 && analysisFailures.length === 0,
    scannedSources: sources.length,
    created,
    draftLimit: limit,
    draftMinCandidates: minCandidates,
    maxSourceAgeDays: options?.maxSourceAgeDays ?? 7,
    draftRetentionDays: cleanup.retentionDays,
    expiredDraftsArchived: cleanup.archived,
    staleDraftsArchived: staleCleanup.archived,
    selectedPending: pendingSubmissions.length,
    analyzed: analyzed.length,
    analyzedIds: analyzed,
    skipped: skipped.length,
    skippedItems: skipped,
    sourceFailures,
    analysisFailures,
  };
}

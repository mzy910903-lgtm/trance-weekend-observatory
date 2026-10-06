import { ArticleStatus, SubmissionStatus } from "@/lib/categories";
import { prisma } from "@/lib/prisma";

export const DEFAULT_DRAFT_RETENTION_DAYS = 14;

export function getDraftRetentionDays() {
  const value = Number.parseInt(
    process.env.AUTO_DRAFT_RETENTION_DAYS ?? "",
    10,
  );

  if (Number.isNaN(value)) return DEFAULT_DRAFT_RETENTION_DAYS;
  return Math.min(Math.max(value, 1), 30);
}

function getExpirationDate(retentionDays: number, now = new Date()) {
  return new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
}

export async function archiveExpiredDrafts(now = new Date()) {
  const retentionDays = getDraftRetentionDays();
  const expiresBefore = getExpirationDate(retentionDays, now);
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
      where: {
        id: { in: expiredDrafts.map((draft) => draft.id) },
        status: ArticleStatus.DRAFT,
        publishedAt: null,
        createdAt: { lt: expiresBefore },
      },
      data: { status: ArticleStatus.ARCHIVED },
    });

    const submissionIds = expiredDrafts
      .map((draft) => draft.submissionId)
      .filter((id): id is string => Boolean(id));

    if (submissionIds.length > 0) {
      await tx.submission.updateMany({
        where: {
          id: { in: submissionIds },
          article: {
            is: {
              status: ArticleStatus.ARCHIVED,
              publishedAt: null,
            },
          },
        },
        data: {
          status: SubmissionStatus.REJECTED,
          errorMessage: `自动清理：草稿超过 ${retentionDays} 天未发布，已移出候选池。`,
        },
      });
    }
  });

  return { retentionDays, archived: expiredDrafts.length };
}

export async function countExpiredDrafts(now = new Date()) {
  const retentionDays = getDraftRetentionDays();
  const expiresBefore = getExpirationDate(retentionDays, now);
  const count = await prisma.article.count({
    where: {
      status: { in: [ArticleStatus.DRAFT, ArticleStatus.ARCHIVED] },
      publishedAt: null,
      createdAt: { lt: expiresBefore },
    },
  });

  return { retentionDays, count };
}

export async function permanentlyDeleteExpiredDrafts(now = new Date()) {
  const retentionDays = getDraftRetentionDays();
  const expiresBefore = getExpirationDate(retentionDays, now);

  return prisma.$transaction(async (tx) => {
    const expiredDrafts = await tx.article.findMany({
      where: {
        status: { in: [ArticleStatus.DRAFT, ArticleStatus.ARCHIVED] },
        publishedAt: null,
        createdAt: { lt: expiresBefore },
      },
      select: { id: true, submissionId: true },
    });

    if (expiredDrafts.length === 0) {
      return { retentionDays, deletedDrafts: 0, deletedSubmissions: 0 };
    }

    const articleIds = expiredDrafts.map((draft) => draft.id);
    const submissionIds = expiredDrafts
      .map((draft) => draft.submissionId)
      .filter((id): id is string => Boolean(id));

    const deletedDrafts = await tx.article.deleteMany({
      where: {
        id: { in: articleIds },
        status: { in: [ArticleStatus.DRAFT, ArticleStatus.ARCHIVED] },
        publishedAt: null,
        createdAt: { lt: expiresBefore },
      },
    });

    const deletedSubmissions =
      submissionIds.length > 0
        ? await tx.submission.deleteMany({
            where: {
              id: { in: submissionIds },
              article: { is: null },
            },
          })
        : { count: 0 };

    return {
      retentionDays,
      deletedDrafts: deletedDrafts.count,
      deletedSubmissions: deletedSubmissions.count,
    };
  });
}

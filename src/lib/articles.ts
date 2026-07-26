import type { Article, ArticleTag, Prisma, Tag } from "@prisma/client";
import { ArticleStatus } from "@/lib/categories";
import { prisma } from "@/lib/prisma";

export type ArticleWithTags = Article & {
  tags: (ArticleTag & { tag: Tag })[];
};

export const articleSorts = [
  { key: "latest", label: "最新" },
  { key: "importance", label: "重要性" },
  { key: "artistry", label: "艺术性" },
  { key: "humor", label: "幽默性" },
] as const;

export type ArticleSort = (typeof articleSorts)[number]["key"];

type ArticleQueryOptions = {
  category?: string;
  tagSlug?: string;
  sort?: string | string[];
  take?: number;
  excludeId?: string;
};

export function normalizeArticleSort(sort?: string | string[]): ArticleSort {
  const value = Array.isArray(sort) ? sort[0] : sort;
  return articleSorts.some((item) => item.key === value)
    ? (value as ArticleSort)
    : "latest";
}

function orderByForSort(sort: ArticleSort): Prisma.ArticleOrderByWithRelationInput[] {
  if (sort === "importance") {
    return [
      { importanceScore: "desc" },
      { sourcePublishedAt: "desc" },
      { publishedAt: "desc" },
      { createdAt: "desc" },
    ];
  }

  if (sort === "artistry") {
    return [
      { artistryScore: "desc" },
      { sourcePublishedAt: "desc" },
      { publishedAt: "desc" },
      { createdAt: "desc" },
    ];
  }

  if (sort === "humor") {
    return [
      { humorScore: "desc" },
      { sourcePublishedAt: "desc" },
      { publishedAt: "desc" },
      { createdAt: "desc" },
    ];
  }

  return [
    { sourcePublishedAt: "desc" },
    { publishedAt: "desc" },
    { createdAt: "desc" },
  ];
}

export async function getPublishedArticles(options: ArticleQueryOptions = {}) {
  const sort = normalizeArticleSort(options.sort);

  return prisma.article.findMany({
    where: {
      status: ArticleStatus.PUBLISHED,
      category: options.category,
      id: options.excludeId ? { not: options.excludeId } : undefined,
      tags: options.tagSlug
        ? { some: { tag: { slug: options.tagSlug } } }
        : undefined,
    },
    include: { tags: { include: { tag: true } } },
    orderBy: orderByForSort(sort),
    take: options.take,
  });
}

export function getPopularTags(articles: ArticleWithTags[], limit = 12) {
  const counts = new Map<string, { tag: Tag; count: number }>();

  for (const article of articles) {
    for (const articleTag of article.tags) {
      const current = counts.get(articleTag.tag.slug);
      counts.set(articleTag.tag.slug, {
        tag: articleTag.tag,
        count: (current?.count ?? 0) + 1,
      });
    }
  }

  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count || a.tag.name.localeCompare(b.tag.name))
    .slice(0, limit);
}

export function getRadarStats(articles: ArticleWithTags[]) {
  const recent = articles.slice(0, 7);
  const total = recent.length || 1;
  const average = (key: "importanceScore" | "artistryScore" | "humorScore") =>
    Math.round(
      recent.reduce((sum, article) => sum + article[key], 0) / total,
    );

  return {
    sampleSize: recent.length,
    importance: average("importanceScore"),
    artistry: average("artistryScore"),
    humor: average("humorScore"),
    density: Math.round(
      (average("importanceScore") +
        average("artistryScore") +
        average("humorScore")) /
        3,
    ),
  };
}

export async function getHomeRadar(sort?: string | string[]) {
  const [articles, latestArticles] = await Promise.all([
    getPublishedArticles({ sort }),
    getPublishedArticles({ sort: "latest" }),
  ]);
  const recentPool = latestArticles.slice(0, 12);
  const leadArticle =
    recentPool.sort(
      (a, b) =>
        b.importanceScore +
        b.artistryScore -
        (a.importanceScore + a.artistryScore),
    )[0] ?? null;

  const [importance, artistry, humor] = await Promise.all([
    getPublishedArticles({ sort: "importance", take: 3 }),
    getPublishedArticles({ sort: "artistry", take: 3 }),
    getPublishedArticles({ sort: "humor", take: 3 }),
  ]);

  return {
    articles,
    leadArticle,
    highlights: { importance, artistry, humor },
    stats: getRadarStats(latestArticles),
    popularTags: getPopularTags(latestArticles),
  };
}

export async function getRelatedArticles(article: ArticleWithTags, take = 3) {
  const tagIds = article.tags.map(({ tagId }) => tagId);

  return prisma.article.findMany({
    where: {
      id: { not: article.id },
      status: ArticleStatus.PUBLISHED,
      OR: [
        { category: article.category },
        tagIds.length
          ? { tags: { some: { tagId: { in: tagIds } } } }
          : { id: "" },
      ],
    },
    include: { tags: { include: { tag: true } } },
    orderBy: [
      { importanceScore: "desc" },
      { sourcePublishedAt: "desc" },
      { publishedAt: "desc" },
      { createdAt: "desc" },
    ],
    take,
  });
}

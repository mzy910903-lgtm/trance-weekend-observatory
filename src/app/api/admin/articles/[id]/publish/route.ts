import { NextResponse } from "next/server";
import { z } from "zod";
import { ArticleCategory, ArticleStatus, SubmissionStatus } from "@/lib/categories";
import { prisma } from "@/lib/prisma";

const publishSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1).max(500),
  fullSummary: z.string().min(1).max(2000),
  category: z.enum([
    ArticleCategory.NEWS,
    ArticleCategory.TRACK,
    ArticleCategory.LABEL,
    ArticleCategory.LIVE,
    ArticleCategory.MEME,
    ArticleCategory.ARCHIVE,
  ]),
  importanceScore: z.coerce.number().int().min(1).max(10),
  artistryScore: z.coerce.number().int().min(1).max(10),
  humorScore: z.coerce.number().int().min(1).max(10),
  scoreExplanation: z.string().min(1).max(1000),
  aiComment: z.string().min(1).max(240),
  tags: z.string().min(1),
});

function tagSlug(name: string) {
  return name.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, "").trim().replace(/\s+/g, "-");
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const form = await request.formData();
  const parsed = publishSchema.safeParse({
    title: form.get("title"),
    summary: form.get("summary"),
    fullSummary: form.get("fullSummary"),
    category: form.get("category"),
    importanceScore: form.get("importanceScore"),
    artistryScore: form.get("artistryScore"),
    humorScore: form.get("humorScore"),
    scoreExplanation: form.get("scoreExplanation"),
    aiComment: form.get("aiComment"),
    tags: form.get("tags"),
  });
  const returnTo = String(form.get("returnTo") || "/admin");

  if (!parsed.success) {
    return NextResponse.json(
      { error: "发布字段不完整或格式错误。" },
      { status: 400 },
    );
  }

  const tagNames = parsed.data.tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 10);

  const existingArticle = await prisma.article.findUnique({
    where: { id },
    select: {
      sourceUrl: true,
      sourcePublishedAt: true,
      submission: { select: { rawPublishedAt: true } },
    },
  });

  if (!existingArticle?.sourceUrl) {
    return NextResponse.json(
      { error: "发布失败：缺少来源链接。" },
      { status: 400 },
    );
  }

  await prisma.$transaction(async (tx) => {
    const article = await tx.article.update({
      where: { id },
      data: {
        title: parsed.data.title,
        summary: parsed.data.summary,
        fullSummary: parsed.data.fullSummary,
        category: parsed.data.category,
        importanceScore: parsed.data.importanceScore,
        artistryScore: parsed.data.artistryScore,
        humorScore: parsed.data.humorScore,
        scoreExplanation: parsed.data.scoreExplanation,
        aiComment: parsed.data.aiComment,
        status: ArticleStatus.PUBLISHED,
        sourcePublishedAt:
          existingArticle.sourcePublishedAt ??
          existingArticle.submission?.rawPublishedAt ??
          null,
        publishedAt: new Date(),
      },
    });

    await tx.articleTag.deleteMany({ where: { articleId: article.id } });

    for (const name of tagNames) {
      const slug = tagSlug(name);
      if (!slug) continue;

      const tag = await tx.tag.upsert({
        where: { slug },
        update: { name },
        create: { name, slug },
      });

      await tx.articleTag.create({
        data: { articleId: article.id, tagId: tag.id },
      });
    }

    if (article.submissionId) {
      await tx.submission.update({
        where: { id: article.submissionId },
        data: { status: SubmissionStatus.PUBLISHED },
      });
    }
  });

  return NextResponse.redirect(
    new URL(returnTo.startsWith("/admin") ? returnTo : "/admin", request.url),
    303,
  );
}

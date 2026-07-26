import { NextResponse } from "next/server";
import { ArticleStatus, SubmissionStatus } from "@/lib/categories";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const form = await request.formData();
  const returnTo = String(form.get("returnTo") || "/admin?status=PUBLISHED");

  const article = await prisma.article.findUnique({
    where: { id },
    select: { status: true, submissionId: true },
  });

  if (!article) {
    return NextResponse.json({ error: "文章不存在。" }, { status: 404 });
  }

  if (article.status !== ArticleStatus.PUBLISHED) {
    return NextResponse.json(
      { error: "只有已发布文章可以下线。" },
      { status: 400 },
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.article.update({
      where: { id },
      data: { status: ArticleStatus.ARCHIVED },
    });

    if (article.submissionId) {
      await tx.submission.update({
        where: { id: article.submissionId },
        data: { status: SubmissionStatus.ANALYZED },
      });
    }
  });

  return NextResponse.redirect(
    new URL(returnTo.startsWith("/admin") ? returnTo : "/admin", request.url),
    303,
  );
}

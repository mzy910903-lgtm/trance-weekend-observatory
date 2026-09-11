import { NextResponse } from "next/server";
import { getCurrentMember, isSameOrigin, safeReturnPath } from "@/lib/member-auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ articleId: string }> },
) {
  if (!isSameOrigin(request)) return new NextResponse("Forbidden", { status: 403 });
  const user = await getCurrentMember();
  const form = await request.formData();
  const returnTo = safeReturnPath(String(form.get("returnTo") ?? "/"));
  if (!user) {
    return NextResponse.redirect(
      new URL(`/login?next=${encodeURIComponent(returnTo)}`, request.url),
      303,
    );
  }

  const { articleId } = await params;
  const article = await prisma.article.findFirst({
    where: { id: articleId, status: "PUBLISHED" },
    select: { id: true },
  });
  if (!article) return new NextResponse("Not found", { status: 404 });

  const existing = await prisma.bookmark.findUnique({
    where: { userId_articleId: { userId: user.id, articleId } },
  });
  if (existing) {
    await prisma.bookmark.delete({
      where: { userId_articleId: { userId: user.id, articleId } },
    });
  } else {
    await prisma.bookmark.create({ data: { userId: user.id, articleId } });
  }
  return NextResponse.redirect(new URL(returnTo, request.url), 303);
}

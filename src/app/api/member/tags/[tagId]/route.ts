import { NextResponse } from "next/server";
import { getCurrentMember, isSameOrigin, safeReturnPath } from "@/lib/member-auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tagId: string }> },
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

  const { tagId } = await params;
  const tag = await prisma.tag.findUnique({ where: { id: tagId }, select: { id: true } });
  if (!tag) return new NextResponse("Not found", { status: 404 });

  const existing = await prisma.tagFollow.findUnique({
    where: { userId_tagId: { userId: user.id, tagId } },
  });
  if (existing) {
    await prisma.tagFollow.delete({ where: { userId_tagId: { userId: user.id, tagId } } });
  } else {
    await prisma.tagFollow.create({ data: { userId: user.id, tagId } });
  }
  return NextResponse.redirect(new URL(returnTo, request.url), 303);
}

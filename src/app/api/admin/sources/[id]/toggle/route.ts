import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const source = await prisma.source.findUnique({ where: { id } });

  if (!source) {
    return NextResponse.json({ error: "来源不存在。" }, { status: 404 });
  }

  await prisma.source.update({
    where: { id },
    data: { enabled: !source.enabled },
  });

  return NextResponse.redirect(new URL("/admin?tab=sources", request.url), 303);
}

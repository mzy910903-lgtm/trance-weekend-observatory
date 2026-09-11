import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const invite = await prisma.inviteCode.findUnique({ where: { id } });
  if (!invite) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.inviteCode.update({
    where: { id },
    data: { enabled: !invite.enabled },
  });
  return NextResponse.json({ enabled: !invite.enabled });
}

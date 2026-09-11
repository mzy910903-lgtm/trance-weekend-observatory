import { NextResponse } from "next/server";
import { z } from "zod";
import { generateInviteCode, hashInviteCode } from "@/lib/member-auth";
import { prisma } from "@/lib/prisma";

const inviteSchema = z.object({
  note: z.string().trim().max(120).optional(),
  maxUses: z.coerce.number().int().min(1).max(100),
  expiresAt: z.string().optional(),
});

export async function POST(request: Request) {
  const parsed = inviteSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "邀请码参数无效。" }, { status: 400 });
  }
  const code = generateInviteCode();
  const expiresAt = parsed.data.expiresAt
    ? new Date(`${parsed.data.expiresAt}T23:59:59+08:00`)
    : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    return NextResponse.json({ error: "有效期格式无效。" }, { status: 400 });
  }
  const invite = await prisma.inviteCode.create({
    data: {
      codeHash: hashInviteCode(code),
      codePrefix: code.slice(0, 7),
      note: parsed.data.note || null,
      maxUses: parsed.data.maxUses,
      expiresAt,
    },
  });
  return NextResponse.json({ code, id: invite.id });
}

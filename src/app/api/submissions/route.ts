import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const submissionSchema = z.object({
  url: z.string().url(),
  nickname: z.string().min(1).max(40),
  note: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  const form = await request.formData();
  const parsed = submissionSchema.safeParse({
    url: form.get("url"),
    nickname: form.get("nickname"),
    note: form.get("note") || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "投稿字段不完整或 URL 无效。" },
      { status: 400 },
    );
  }

  const existing = await prisma.submission.findFirst({
    where: { url: parsed.data.url },
    select: { id: true },
  });

  if (existing) {
    return NextResponse.redirect(
      new URL("/submit?status=duplicate", request.url),
      303,
    );
  }

  await prisma.submission.create({
    data: {
      url: parsed.data.url,
      nickname: parsed.data.nickname,
      note: parsed.data.note,
      discoveredAt: new Date(),
    },
  });

  return NextResponse.redirect(new URL("/submit?status=success", request.url), 303);
}

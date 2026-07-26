import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sourceTypeKeys } from "@/lib/source-types";

const sourceSchema = z.object({
  name: z.string().min(1).max(80),
  url: z.string().url(),
  feedUrl: z.string().url(),
  type: z.enum(sourceTypeKeys).default("RSS"),
});

export async function POST(request: Request) {
  const form = await request.formData();
  const parsed = sourceSchema.safeParse({
    name: form.get("name"),
    url: form.get("url"),
    feedUrl: form.get("feedUrl"),
    type: form.get("type") || "RSS",
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "来源名称、主页 URL 或 RSS URL 无效。" },
      { status: 400 },
    );
  }

  await prisma.source.upsert({
    where: { url: parsed.data.url },
    update: {
      name: parsed.data.name,
      feedUrl: parsed.data.feedUrl,
      type: parsed.data.type,
      enabled: true,
    },
    create: {
      name: parsed.data.name,
      url: parsed.data.url,
      feedUrl: parsed.data.feedUrl,
      type: parsed.data.type,
      enabled: true,
    },
  });

  return NextResponse.redirect(new URL("/admin?tab=sources", request.url), 303);
}

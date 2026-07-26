import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { scanSource } from "@/lib/source-scan";

export async function POST(request: Request) {
  const sources = await prisma.source.findMany({
    where: { enabled: true, feedUrl: { not: null } },
    select: { id: true },
  });

  let created = 0;
  let failed = 0;

  for (const source of sources) {
    const result = await scanSource(source.id);
    if (result.ok) {
      created += result.created;
    } else {
      failed += 1;
    }
  }

  const params = new URLSearchParams({
    tab: "sources",
    scan: String(created),
  });

  if (failed > 0) {
    params.set("scanError", `${failed} 个来源扫描失败，请单独重试。`);
  }

  return NextResponse.redirect(new URL(`/admin?${params}`, request.url), 303);
}

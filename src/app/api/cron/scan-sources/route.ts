import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { scanSource } from "@/lib/source-scan";

export const dynamic = "force-dynamic";

function readBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  return authorization.slice("Bearer ".length).trim();
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const token = readBearerToken(request) ?? new URL(request.url).searchParams.get("secret");

  if (!secret || token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sources = await prisma.source.findMany({
    where: { enabled: true, feedUrl: { not: null } },
    select: { id: true, name: true },
  });

  let created = 0;
  const failures: string[] = [];

  for (const source of sources) {
    const result = await scanSource(source.id);
    if (result.ok) {
      created += result.created;
    } else {
      failures.push(`${source.name}: ${result.error ?? "扫描失败"}`);
    }
  }

  return NextResponse.json({
    ok: failures.length === 0,
    scannedSources: sources.length,
    created,
    failures,
  });
}

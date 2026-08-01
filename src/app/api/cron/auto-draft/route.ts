import { NextResponse } from "next/server";
import { runAutoDraft } from "@/lib/auto-draft";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function readBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  return authorization.slice("Bearer ".length).trim();
}

function readBootstrapDays(request: Request) {
  const value = new URL(request.url).searchParams.get("bootstrapDays");
  if (!value) return undefined;

  const days = Number.parseInt(value, 10);
  return days >= 8 && days <= 14 ? days : null;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const token =
    readBearerToken(request) ?? new URL(request.url).searchParams.get("secret");

  if (!secret || token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bootstrapDays = readBootstrapDays(request);
  if (bootstrapDays === null) {
    return NextResponse.json(
      { error: "bootstrapDays 只能在 8 到 14 天之间。" },
      { status: 400 },
    );
  }

  const result = await runAutoDraft({ maxSourceAgeDays: bootstrapDays });
  return NextResponse.json(result, { status: result.ok ? 200 : 207 });
}

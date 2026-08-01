import { NextResponse } from "next/server";
import { runAutoDraft } from "@/lib/auto-draft";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const form = await request.formData();
  const requestedAgeDays = Number.parseInt(
    String(form.get("maxSourceAgeDays") ?? ""),
    10,
  );
  const maxSourceAgeDays =
    requestedAgeDays === 14 || requestedAgeDays === 30
      ? requestedAgeDays
      : undefined;
  const result = await runAutoDraft({
    maxSourceAgeDays,
    limit: maxSourceAgeDays === 30 ? 30 : undefined,
  });
  const url = new URL("/admin", request.url);
  url.searchParams.set("status", "ANALYZED");

  if (result.analyzed > 0) {
    url.searchParams.set("refreshed", String(result.analyzed));
  }

  if (maxSourceAgeDays) {
    url.searchParams.set("backfillDays", String(maxSourceAgeDays));
  }

  if (!result.ok) {
    const error = [
      ...result.sourceFailures,
      ...result.analysisFailures.map((failure) => failure.error),
    ]
      .filter(Boolean)
      .join("；");

    if (error) {
      url.searchParams.set("refreshError", error.slice(0, 500));
    }
  }

  return NextResponse.redirect(url, 303);
}

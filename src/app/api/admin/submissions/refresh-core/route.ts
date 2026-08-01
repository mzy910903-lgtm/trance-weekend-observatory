import { NextResponse } from "next/server";
import { runAutoDraft } from "@/lib/auto-draft";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const result = await runAutoDraft();
  const url = new URL("/admin", request.url);
  url.searchParams.set("status", "ANALYZED");

  if (result.analyzed > 0) {
    url.searchParams.set("refreshed", String(result.analyzed));
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

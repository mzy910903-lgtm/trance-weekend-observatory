import { NextResponse } from "next/server";
import { cleanupOutOfScopeCandidates } from "@/lib/auto-draft";

export async function POST(request: Request) {
  const result = await cleanupOutOfScopeCandidates();
  const url = new URL("/admin", request.url);
  url.searchParams.set("status", "ANALYZED");
  url.searchParams.set(
    "scan",
    String(result.rejectedPending + result.archivedDrafts),
  );

  return NextResponse.redirect(url, 303);
}

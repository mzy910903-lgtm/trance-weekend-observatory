import { NextResponse } from "next/server";
import { scrapeSubmission } from "@/lib/submission-scrape";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await scrapeSubmission(id);

  if (!result.ok && result.error === "投稿不存在。") {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.redirect(new URL("/admin?status=PENDING", request.url), 303);
}

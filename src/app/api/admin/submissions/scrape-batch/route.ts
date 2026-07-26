import { NextResponse } from "next/server";
import { SubmissionStatus } from "@/lib/categories";
import { prisma } from "@/lib/prisma";
import { scrapeSubmission } from "@/lib/submission-scrape";

export async function POST(request: Request) {
  const form = await request.formData();
  const requestedIds = form
    .getAll("submissionId")
    .map((value) => String(value))
    .filter(Boolean)
    .slice(0, 10);

  const pendingSubmissions = await prisma.submission.findMany({
    where: {
      id: { in: requestedIds },
      status: SubmissionStatus.PENDING,
    },
    select: { id: true },
  });

  for (const submission of pendingSubmissions) {
    await scrapeSubmission(submission.id);
  }

  return NextResponse.redirect(new URL("/admin?status=PENDING", request.url), 303);
}

import { NextResponse } from "next/server";
import { scanSource } from "@/lib/source-scan";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await scanSource(id);

  if (result.ok) {
    return NextResponse.redirect(
      new URL(`/admin?tab=sources&scan=${result.created}`, request.url),
      303,
    );
  }

  return NextResponse.redirect(
    new URL(
      `/admin?tab=sources&scanError=${encodeURIComponent(
        (result.error ?? "来源扫描失败。").slice(0, 160),
      )}`,
      request.url,
    ),
    303,
  );
}

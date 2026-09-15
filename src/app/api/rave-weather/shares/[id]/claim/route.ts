import { NextResponse } from "next/server";
import { claimRaveWeatherShare } from "@/lib/rave-weather-shares";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const status = await claimRaveWeatherShare(id);
  if (!status) return NextResponse.json({ error: "Weather not found" }, { status: 404, headers });
  return NextResponse.json({
    state: status.state,
    claimedAt: status.claimedAt.toISOString(),
  }, { headers });
}

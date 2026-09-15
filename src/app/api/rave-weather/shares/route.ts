import { NextResponse } from "next/server";
import { createRaveWeatherShare, deleteExpiredRaveWeatherShares, raveWeatherShareUrl } from "@/lib/rave-weather-shares";

export const dynamic = "force-dynamic";

function corsOrigin(request: Request) {
  const origin = request.headers.get("origin") || "";
  if (!origin) return "";
  try {
    const url = new URL(origin);
    const requestOrigin = new URL(request.url).origin;
    if (origin === requestOrigin || origin === "https://observatory.tranceweekend.com" || ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) return origin;
  } catch {}
  return "";
}

function corsHeaders(origin: string): Record<string, string> {
  return origin ? {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  } : {};
}

export async function OPTIONS(request: Request) {
  const origin = corsOrigin(request);
  return new NextResponse(null, { status: origin ? 204 : 403, headers: corsHeaders(origin) });
}

export async function POST(request: Request) {
  const origin = corsOrigin(request);
  if (request.headers.get("origin") && !origin) return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 4_096) return NextResponse.json({ error: "Result is too large" }, { status: 413, headers: corsHeaders(origin) });
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: corsHeaders(origin) });
  }
  try {
    const share = await createRaveWeatherShare((payload as { weather?: unknown })?.weather);
    if (!share) return NextResponse.json({ error: "Invalid weather result" }, { status: 400, headers: corsHeaders(origin) });
    await deleteExpiredRaveWeatherShares().catch(() => undefined);
    return NextResponse.json({
      id: share.id,
      url: raveWeatherShareUrl(share.id, request.url),
      expiresAt: share.expiresAt.toISOString(),
    }, { status: 201, headers: { ...corsHeaders(origin), "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Short link service unavailable" }, { status: 503, headers: { ...corsHeaders(origin), "Cache-Control": "no-store" } });
  }
}

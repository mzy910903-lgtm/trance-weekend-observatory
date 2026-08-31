import { NextResponse } from "next/server";
import { getDashboardSummary } from "@/lib/dashboard-summary";

export const dynamic = "force-dynamic";

function readBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  return authorization.slice("Bearer ".length).trim();
}

export async function GET(request: Request) {
  const expectedToken = process.env.OBSERVATORY_DASHBOARD_TOKEN;
  const token = readBearerToken(request);

  if (!expectedToken || token !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await getDashboardSummary();
  return NextResponse.json(
    { ok: true, ...summary },
    { headers: { "Cache-Control": "no-store" } },
  );
}

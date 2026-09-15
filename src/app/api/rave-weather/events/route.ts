import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { raveWeatherEvents } from "@/lib/rave-weather-events";

export const dynamic = "force-dynamic";

function shanghaiDay() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export async function POST(request: Request) {
  let payload: { event?: unknown; dimension?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof payload.event !== "string" || !raveWeatherEvents.includes(payload.event as never)) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }
  const dimension = typeof payload.dimension === "string"
    ? payload.dimension.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48)
    : "";
  await prisma.raveWeatherMetric.upsert({
    where: { day_event_dimension: { day: shanghaiDay(), event: payload.event, dimension } },
    create: { day: shanghaiDay(), event: payload.event, dimension, count: 1 },
    update: { count: { increment: 1 } },
  });
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}

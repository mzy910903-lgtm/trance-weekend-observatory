import "server-only";
import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decodeWeather, type Weather } from "@/components/rave-weather/weather";

export const RAVE_WEATHER_SHARE_DAYS = 7;
const MAX_PAYLOAD_BYTES = 3_600;
const SHARE_ID = /^[A-Za-z0-9_-]{12}$/;

function sanitizedWeather(weather: Weather): Weather {
  return {
    v: 1,
    seed: weather.seed,
    name: weather.name,
    ...(weather.nameZh ? { nameZh: weather.nameZh } : {}),
    quote: weather.quote,
    ...(weather.quoteZh ? { quoteZh: weather.quoteZh } : {}),
    ...(weather.conflict ? { conflict: weather.conflict } : {}),
    ...(weather.remarkZh ? { remarkZh: weather.remarkZh } : {}),
    date: weather.date,
    phase: weather.phase,
    signals: { ...weather.signals },
    demo: weather.demo,
    ...(weather.maxCombo ? { maxCombo: weather.maxCombo } : {}),
    ...(weather.onBeatCount ? { onBeatCount: weather.onBeatCount } : {}),
    ...(weather.easterEggZh ? { easterEggZh: weather.easterEggZh } : {}),
    ...(weather.highlight ? { highlight: weather.highlight } : {}),
    ...(weather.highlightCaptionZh ? { highlightCaptionZh: weather.highlightCaptionZh } : {}),
    ...(weather.visualKind ? { visualKind: weather.visualKind } : {}),
  };
}

export function parseRaveWeatherShare(input: unknown): Weather | null {
  let encoded: string;
  try {
    encoded = JSON.stringify(input);
  } catch {
    return null;
  }
  if (!encoded || new TextEncoder().encode(encoded).length > MAX_PAYLOAD_BYTES) return null;
  const weather = decodeWeather(`#${encodeURIComponent(encoded)}`);
  return weather ? sanitizedWeather(weather) : null;
}

export async function createRaveWeatherShare(input: unknown) {
  const weather = parseRaveWeatherShare(input);
  if (!weather) return null;
  const payload = JSON.stringify(weather);
  const expiresAt = new Date(Date.now() + RAVE_WEATHER_SHARE_DAYS * 24 * 60 * 60 * 1000);
  for (let attempt = 0; attempt < 3; attempt++) {
    const id = randomBytes(9).toString("base64url");
    try {
      await prisma.raveWeatherShare.create({ data: { id, payload, expiresAt } });
      return { id, expiresAt, weather };
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    }
  }
  throw new Error("Unable to allocate a weather share id");
}

export async function getRaveWeatherShare(id: string) {
  if (!SHARE_ID.test(id)) return null;
  const row = await prisma.raveWeatherShare.findUnique({ where: { id } });
  if (!row) return null;
  if (row.expiresAt <= new Date()) {
    await prisma.raveWeatherShare.delete({ where: { id } }).catch(() => undefined);
    return null;
  }
  try {
    return parseRaveWeatherShare(JSON.parse(row.payload));
  } catch {
    return null;
  }
}

export async function getRaveWeatherShareStatus(id: string) {
  if (!SHARE_ID.test(id)) return null;
  const row = await prisma.raveWeatherShare.findUnique({
    where: { id },
    select: { expiresAt: true, claimedAt: true, claimCount: true },
  });
  if (!row || row.expiresAt <= new Date()) return null;
  return { state: row.claimedAt ? "claimed" as const : "waiting" as const, claimedAt: row.claimedAt, claimCount: row.claimCount };
}

export async function claimRaveWeatherShare(id: string) {
  if (!SHARE_ID.test(id)) return null;
  const existing = await prisma.raveWeatherShare.findUnique({
    where: { id },
    select: { expiresAt: true, claimedAt: true },
  });
  if (!existing || existing.expiresAt <= new Date()) return null;
  const claimedAt = existing.claimedAt ?? new Date();
  const row = await prisma.raveWeatherShare.update({
    where: { id },
    data: { claimedAt, claimCount: { increment: 1 } },
    select: { claimedAt: true, claimCount: true },
  });
  return { state: "claimed" as const, claimedAt: row.claimedAt!, claimCount: row.claimCount };
}

export async function deleteExpiredRaveWeatherShares() {
  const result = await prisma.raveWeatherShare.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  return result.count;
}

export function raveWeatherShareUrl(id: string, requestUrl?: string) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const base = configured || (requestUrl ? new URL(requestUrl).origin : "https://observatory.tranceweekend.com");
  return `${base}/rave-weather/r/${id}`;
}

import { prisma } from "@/lib/prisma";

const funnelEvents = ["view", "home_entry", "start_camera", "start_demo", "complete", "qr_shown", "qr_claimed", "mobile_share_complete", "mobile_download"] as const;

function shanghaiDay(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function dayOffset(days: number) {
  return shanghaiDay(new Date(Date.now() - days * 86_400_000));
}

export async function getRaveWeatherAnalytics() {
  const [recent, allTime] = await Promise.all([
    prisma.raveWeatherMetric.findMany({
      where: { day: { gte: dayOffset(13) } },
      orderBy: [{ day: "asc" }, { event: "asc" }],
    }),
    prisma.raveWeatherMetric.groupBy({
      by: ["event", "dimension"],
      _sum: { count: true },
    }),
  ]);
  const today = shanghaiDay();
  const count = (rows: typeof recent, event: string, from?: string) =>
    rows.filter(row => row.event === event && (!from || row.day >= from)).reduce((sum, row) => sum + row.count, 0);
  const summarize = (rows: typeof recent, from?: string) => {
    const cameraStarts = count(rows, "start_camera", from);
    const demoStarts = count(rows, "start_demo", from);
    const completions = count(rows, "complete", from);
    const qrShown = count(rows, "qr_shown", from);
    const claims = count(rows, "qr_claimed", from);
    const mobileTakes = count(rows, "mobile_share_complete", from) + count(rows, "mobile_download", from);
    const shares = count(rows, "share_poster", from) + count(rows, "copy_link", from) + mobileTakes;
    const starts = cameraStarts + demoStarts;
    return {
      views: count(rows, "view", from),
      homeEntries: count(rows, "home_entry", from),
      starts,
      cameraStarts,
      demoStarts,
      completions,
      shares,
      qrShown,
      claims,
      mobileTakes,
      completionRate: starts ? Math.round((completions / starts) * 1000) / 10 : 0,
      shareRate: completions ? Math.round((shares / completions) * 1000) / 10 : 0,
      claimRate: qrShown ? Math.round((claims / qrShown) * 1000) / 10 : 0,
      mobileTakeRate: claims ? Math.round((mobileTakes / claims) * 1000) / 10 : 0,
    };
  };
  const allTimeValue = (event: string) => allTime.filter(row => row.event === event).reduce((sum, row) => sum + (row._sum.count ?? 0), 0);
  const allStarts = allTimeValue("start_camera") + allTimeValue("start_demo");
  const allCompletions = allTimeValue("complete");
  const allQrShown = allTimeValue("qr_shown");
  const allClaims = allTimeValue("qr_claimed");
  const allMobileTakes = allTimeValue("mobile_share_complete") + allTimeValue("mobile_download");
  const allShares = allTimeValue("share_poster") + allTimeValue("copy_link") + allMobileTakes;
  const weatherCounts = allTime
    .filter(row => row.event === "complete" && row.dimension)
    .map(row => ({ kind: row.dimension, count: row._sum.count ?? 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  const days = Array.from({ length: 14 }, (_, index) => dayOffset(13 - index));
  return {
    today: summarize(recent.filter(row => row.day === today)),
    last7Days: summarize(recent, dayOffset(6)),
    allTime: {
      views: allTimeValue("view"),
      homeEntries: allTimeValue("home_entry"),
      starts: allStarts,
      cameraStarts: allTimeValue("start_camera"),
      demoStarts: allTimeValue("start_demo"),
      completions: allCompletions,
      shares: allShares,
      qrShown: allQrShown,
      claims: allClaims,
      mobileTakes: allMobileTakes,
      completionRate: allStarts ? Math.round((allCompletions / allStarts) * 1000) / 10 : 0,
      shareRate: allCompletions ? Math.round((allShares / allCompletions) * 1000) / 10 : 0,
      claimRate: allQrShown ? Math.round((allClaims / allQrShown) * 1000) / 10 : 0,
      mobileTakeRate: allClaims ? Math.round((allMobileTakes / allClaims) * 1000) / 10 : 0,
    },
    topWeather: weatherCounts,
    daily: days.map(day => ({
      day,
      views: count(recent.filter(row => row.day === day), "view"),
      starts: count(recent.filter(row => row.day === day), "start_camera") + count(recent.filter(row => row.day === day), "start_demo"),
      completions: count(recent.filter(row => row.day === day), "complete"),
      shares: count(recent.filter(row => row.day === day), "share_poster")
        + count(recent.filter(row => row.day === day), "copy_link")
        + count(recent.filter(row => row.day === day), "mobile_share_complete")
        + count(recent.filter(row => row.day === day), "mobile_download"),
      claims: count(recent.filter(row => row.day === day), "qr_claimed"),
      mobileTakes: count(recent.filter(row => row.day === day), "mobile_share_complete") + count(recent.filter(row => row.day === day), "mobile_download"),
    })),
    trackedEvents: funnelEvents,
  };
}

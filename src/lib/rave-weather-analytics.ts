import { prisma } from "@/lib/prisma";

const funnelEvents = ["view", "home_entry", "start_camera", "start_demo", "complete", "shared_view", "qr_shown", "qr_claimed", "mobile_share_complete", "mobile_download"] as const;

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
  const [rows, allTime] = await Promise.all([
    prisma.raveWeatherMetric.findMany({
      orderBy: [{ day: "asc" }, { event: "asc" }],
    }),
    prisma.raveWeatherMetric.groupBy({
      by: ["event", "dimension"],
      _sum: { count: true },
    }),
  ]);
  const today = shanghaiDay();
  const count = (metricRows: typeof rows, event: string, from?: string) =>
    metricRows.filter(row => row.event === event && (!from || row.day >= from)).reduce((sum, row) => sum + row.count, 0);
  const summarize = (metricRows: typeof rows, from?: string) => {
    const cameraStarts = count(metricRows, "start_camera", from);
    const demoStarts = count(metricRows, "start_demo", from);
    const completions = count(metricRows, "complete", from);
    const resultViews = count(metricRows, "shared_view", from);
    const qrShown = count(metricRows, "qr_shown", from);
    const claims = count(metricRows, "qr_claimed", from);
    const mobileTakes = count(metricRows, "mobile_share_complete", from) + count(metricRows, "mobile_download", from);
    const shares = count(metricRows, "share_poster", from) + count(metricRows, "copy_link", from) + mobileTakes;
    const starts = cameraStarts + demoStarts;
    return {
      views: count(metricRows, "view", from),
      homeEntries: count(metricRows, "home_entry", from),
      starts,
      cameraStarts,
      demoStarts,
      completions,
      resultViews,
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
  const allResultViews = allTimeValue("shared_view");
  const allQrShown = allTimeValue("qr_shown");
  const allClaims = allTimeValue("qr_claimed");
  const allMobileTakes = allTimeValue("mobile_share_complete") + allTimeValue("mobile_download");
  const allShares = allTimeValue("share_poster") + allTimeValue("copy_link") + allMobileTakes;
  const weatherCounts = allTime
    .filter(row => row.event === "complete" && row.dimension)
    .map(row => ({ kind: row.dimension, count: row._sum.count ?? 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  const days = [...new Set([
    ...rows.map(row => row.day),
    ...Array.from({ length: 14 }, (_, index) => dayOffset(13 - index)),
  ])].sort();
  return {
    today: summarize(rows.filter(row => row.day === today)),
    last7Days: summarize(rows, dayOffset(6)),
    allTime: {
      views: allTimeValue("view"),
      homeEntries: allTimeValue("home_entry"),
      starts: allStarts,
      cameraStarts: allTimeValue("start_camera"),
      demoStarts: allTimeValue("start_demo"),
      completions: allCompletions,
      resultViews: allResultViews,
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
    daily: days.map(day => {
      const dayRows = rows.filter(row => row.day === day);
      return {
        day,
        views: count(dayRows, "view"),
        starts: count(dayRows, "start_camera") + count(dayRows, "start_demo"),
        completions: count(dayRows, "complete"),
        resultViews: count(dayRows, "shared_view"),
        shares: count(dayRows, "share_poster")
          + count(dayRows, "copy_link")
          + count(dayRows, "mobile_share_complete")
          + count(dayRows, "mobile_download"),
        qrShown: count(dayRows, "qr_shown"),
        claims: count(dayRows, "qr_claimed"),
        mobileTakes: count(dayRows, "mobile_share_complete") + count(dayRows, "mobile_download"),
      };
    }),
    trackedEvents: funnelEvents,
  };
}

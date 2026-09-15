export const raveWeatherEvents = [
  "view",
  "shared_view",
  "home_entry",
  "start_camera",
  "start_demo",
  "complete",
  "share_poster",
  "share_ready",
  "share_opened",
  "share_failed",
  "share_fallback",
  "qr_shown",
  "qr_claimed",
  "mobile_share_opened",
  "mobile_share_complete",
  "mobile_download",
  "copy_link",
  "copy_caption",
  "download_poster",
  "download_highlight",
] as const;

export type RaveWeatherEvent = (typeof raveWeatherEvents)[number];

const portalEventFor = (event: RaveWeatherEvent) => {
  if (["share_ready", "share_opened", "share_failed", "share_fallback", "qr_shown", "qr_claimed", "mobile_share_opened"].includes(event)) return null;
  if (event === "view") return "page_view";
  if (event === "shared_view") return "result_view";
  if (event === "home_entry") return "start_minigame";
  if (event === "start_camera" || event === "start_demo") return "start_quiz";
  if (event === "complete") return "finish_quiz";
  return "poster_generate";
};

const visitorId = () => {
  const key = "tw_portal_visitor_id";
  try {
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const created = `${Date.now().toString(36)}-${crypto.randomUUID()}`;
    window.localStorage.setItem(key, created);
    return created;
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  }
};

export function trackRaveWeatherEvent(event: RaveWeatherEvent, dimension = "") {
  if (typeof window === "undefined") return;
  const body = JSON.stringify({ event, dimension: dimension.slice(0, 48) });
  const sentLocally = navigator.sendBeacon?.("/api/rave-weather/events", new Blob([body], { type: "application/json" }));
  if (!sentLocally) {
    void fetch("/api/rave-weather/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => undefined);
  }

  const portalEvent = portalEventFor(event);
  if (!portalEvent) return;
  const portalBody = JSON.stringify({
    event: portalEvent,
    visitorId: visitorId(),
    source: "rave-weather",
    path: "/rave-weather",
    resultId: dimension.replace(/[^a-zA-Z0-9]/g, "").slice(0, 40) || undefined,
    ts: Date.now(),
  });
  void fetch("https://www.tranceweekend.com/api/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: portalBody,
    keepalive: true,
  }).catch(() => undefined);
}

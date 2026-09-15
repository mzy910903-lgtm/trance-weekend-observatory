import { ImageResponse } from "next/og";
import { weatherDefinition, weatherNameZh, weatherQuoteZh, weatherVisualKind } from "@/components/rave-weather/weather";
import { getRaveWeatherShare } from "@/lib/rave-weather-shares";

export const alt = "TRANCEWEEKEND RAVE WEATHER 专属天气";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const weather = await getRaveWeatherShare(id);
  if (!weather) return new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#080a0c", color: "#e8efec", fontSize: 62 }}>这场天气已经散了</div>, size);
  const definition = weatherDefinition(weatherVisualKind(weather));
  const materials = new Set(definition.materials);
  const ribbons = Array.from({ length: 7 }, (_, index) => ({
    left: ((weather.seed * (index + 3) * 17) % 950) - 130,
    top: 30 + ((weather.seed * (index + 7) * 11) % 470),
    rotate: -28 + ((weather.seed + index * 41) % 56),
    color: index % 2 ? definition.palette.primary : definition.palette.secondary,
  }));
  const clouds = Array.from({ length: 9 }, (_, index) => ({
    left: -90 + ((weather.seed * (index + 5) * 23) % 1130),
    top: 34 + ((weather.seed * (index + 11) * 13) % 300),
    width: 230 + ((weather.seed + index * 67) % 260),
    color: index % 2 ? definition.palette.primary : definition.palette.secondary,
  }));
  const rain = Array.from({ length: 34 }, (_, index) => ({
    left: ((weather.seed * (index + 17) * 19) % 1240),
    top: ((weather.seed * (index + 29) * 7) % 590),
    height: 28 + ((weather.seed + index * 31) % 82),
  }));
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", overflow: "hidden", color: "#f5f8f6", background: `radial-gradient(circle at 52% 42%, ${definition.palette.primary}55 0%, ${definition.palette.dark} 52%, #030507 100%)` }}>
      {(materials.has("cloud") || materials.has("fog")) && clouds.map((cloud, index) => <div key={`cloud-${index}`} style={{ position: "absolute", left: cloud.left, top: cloud.top, width: cloud.width, height: 96 + index % 3 * 34, borderRadius: 999, background: `radial-gradient(ellipse, ${cloud.color}45 0%, ${cloud.color}14 48%, transparent 74%)`, filter: `blur(${18 + index % 3 * 8}px)`, opacity: materials.has("fog") ? .62 : .48 }} />)}
      {(materials.has("aurora") || materials.has("wind") || materials.has("heat") || materials.has("vortex")) && ribbons.map((ribbon, index) => <div key={`ribbon-${index}`} style={{ position: "absolute", left: ribbon.left, top: ribbon.top, width: 620, height: index % 3 === 0 ? 96 : 38, borderRadius: 999, transform: `rotate(${materials.has("vortex") ? ribbon.rotate + 34 : ribbon.rotate}deg)`, background: `linear-gradient(90deg, transparent, ${ribbon.color}88, transparent)`, filter: `blur(${index % 3 === 0 ? 25 : 10}px)`, opacity: .56 }} />)}
      {(materials.has("rain")) && rain.map((drop, index) => <div key={`rain-${index}`} style={{ position: "absolute", left: drop.left, top: drop.top, width: 2 + index % 3, height: drop.height, borderRadius: 99, transform: `rotate(${definition.kind === "midnightInversion" ? 172 : -18}deg)`, background: index % 4 ? definition.palette.secondary : definition.palette.primary, boxShadow: `0 0 10px ${definition.palette.accent}`, opacity: .28 + index % 4 * .06 }} />)}
      {(materials.has("pressure") || materials.has("caustics")) && Array.from({ length: 6 }, (_, index) => <div key={`pressure-${index}`} style={{ position: "absolute", left: 600 - (120 + index * 88), top: 318 - (28 + index * 20), width: 240 + index * 176, height: 56 + index * 40, border: `2px solid ${index % 2 ? definition.palette.primary : definition.palette.accent}55`, borderRadius: "50%", boxShadow: `0 0 18px ${definition.palette.primary}44`, opacity: .62 - index * .07 }} />)}
      {(materials.has("sunrise") || materials.has("spectrum")) && <div style={{ position: "absolute", left: 348, top: 126, width: 504, height: 504, borderRadius: "50%", background: `radial-gradient(circle, ${definition.palette.accent}bb 0%, ${definition.palette.primary}66 22%, ${definition.palette.secondary}22 48%, transparent 72%)`, filter: "blur(4px)", opacity: .8 }} />}
      {materials.has("lightning") && <svg width="1200" height="630" viewBox="0 0 1200 630" style={{ position: "absolute", inset: 0 }}><defs><filter id="weather-glow"><feGaussianBlur stdDeviation="7" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs><path d="M760 42 L690 178 L738 192 L625 352 L666 218 L618 202 Z" fill={definition.palette.accent} opacity=".72" filter="url(#weather-glow)" /><path d="M330 88 L294 188 L326 196 L258 314" fill="none" stroke={definition.palette.primary} strokeWidth="5" strokeLinecap="round" opacity=".5" filter="url(#weather-glow)" /></svg>}
      <div style={{ position: "absolute", inset: 0, display: "flex", background: "linear-gradient(90deg, rgba(2,4,7,.76) 0%, rgba(2,4,7,.08) 45%, rgba(2,4,7,.26) 100%)" }} />
      <div style={{ position: "absolute", left: 66, top: 48, display: "flex", fontSize: 17, letterSpacing: 3, color: "rgba(240,248,245,.72)" }}>TRANCEWEEKEND / RAVE WEATHER</div>
      <div style={{ position: "absolute", left: 66, bottom: 58, width: 590, display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 70, lineHeight: 1.02, letterSpacing: -3 }}>{weatherNameZh(weather)}</div>
        <div style={{ fontSize: 17, letterSpacing: 4, marginTop: 13, color: definition.palette.accent }}>{weather.name}</div>
        <div style={{ fontSize: 24, marginTop: 22, color: "rgba(245,248,246,.86)" }}>{weatherQuoteZh(weather)}</div>
      </div>
      <div style={{ position: "absolute", right: 55, bottom: 48, display: "flex", fontSize: 14, letterSpacing: 2, color: "rgba(240,248,245,.55)" }}>7 DAY FORECAST</div>
    </div>,
    size,
  );
}

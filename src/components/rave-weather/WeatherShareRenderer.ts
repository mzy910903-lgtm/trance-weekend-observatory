import { weatherNameZh, weatherQuoteZh, weatherVisualKind, type Weather } from "./weather";
import { decodeHighlight } from "./interaction";
import { drawWeatherScene, weatherPalettes, type WeatherMotionCue } from "./WeatherRenderer";

export const WEATHER_SHARE_SECONDS = 4;
export const WEATHER_SHARE_WIDTH = 720;
export const WEATHER_SHARE_HEIGHT = 1280;
function clamp01(value: number) { return Math.max(0, Math.min(1, value)); }
function smoothstep(value: number) { const t = clamp01(value); return t * t * (3 - 2 * t); }

type HighlightFrames = NonNullable<ReturnType<typeof decodeHighlight>>;

function weatherMotionCue(weather: Weather, frames: HighlightFrames | null, time: number): WeatherMotionCue {
  const fallback = {
    energy: clamp01(weather.signals.movement / 100),
    direction: 0,
    expansion: clamp01(weather.signals.openness / 100),
  };
  if (!frames?.length || !weather.highlight) return fallback;
  const frameIndex = Math.min(frames.length - 1, Math.max(0, Math.floor(time * weather.highlight.fps)));
  const current = frames[frameIndex];
  if (!current) return fallback;
  let distance = 0, horizontal = 0, samples = 0;
  for (let step = Math.max(1, frameIndex - 2); step <= frameIndex; step++) {
    const before = frames[step - 1], after = frames[step];
    if (!before || !after) continue;
    [3, 4, 5, 6].forEach(pointIndex => {
      const from = before[pointIndex], to = after[pointIndex];
      if (!from || !to) return;
      distance += Math.hypot(to.x - from.x, to.y - from.y);
      horizontal += to.x - from.x;
      samples += 1;
    });
  }
  const left = current[5] ?? current[3], right = current[6] ?? current[4];
  const trackedEnergy = samples ? clamp01(distance / samples * weather.highlight.fps * .72) : fallback.energy;
  const trackedDirection = samples ? Math.max(-1, Math.min(1, horizontal / samples * weather.highlight.fps * 1.35)) : 0;
  const trackedExpansion = left && right ? clamp01((Math.abs(left.x - right.x) - .65) / 2.8) : fallback.expansion;
  return {
    energy: clamp01(fallback.energy * .35 + trackedEnergy * .65),
    direction: trackedDirection,
    expansion: clamp01(fallback.expansion * .35 + trackedExpansion * .65),
  };
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, initial: number) {
  let size = initial;
  while (size > 34) { ctx.font = `500 ${size}px 'PingFang SC','Microsoft YaHei',sans-serif`; if (ctx.measureText(text).width <= maxWidth) break; size -= 2; }
  return size;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines = 2) {
  const lines: string[] = []; let line = ""; let used = 0;
  for (const char of text) {
    if (line && ctx.measureText(line + char).width > maxWidth) { lines.push(line); used += line.length; line = char; if (lines.length === maxLines - 1) break; }
    else line += char;
  }
  if (lines.length < maxLines) {
    const rest = text.slice(used); let final = rest;
    while (ctx.measureText(final).width > maxWidth && final.length > 1) final = final.slice(0, -1);
    if (final.length < rest.length) final = `${final.slice(0, -1)}…`;
    if (final) lines.push(final);
  }
  return lines;
}

export function drawWeatherShareFrame(canvas: HTMLCanvasElement, weather: Weather, elapsed: number, options: { typography?: boolean; reducedMotion?: boolean } = {}) {
  const ctx = canvas.getContext("2d"); if (!ctx) return;
  const time = Math.max(0, Math.min(WEATHER_SHARE_SECONDS, elapsed));
  const reveal = smoothstep(time / .6), finale = smoothstep((time - 2.7) / .7);
  const kind = weatherVisualKind(weather), palette = weatherPalettes[kind];
  const frames = weather.highlight ? decodeHighlight(weather.highlight) : null;
  const weatherTime = time < 3.1 ? time : 3.1 + (time - 3.1) * .12;
  drawWeatherScene(canvas, {
    kind,
    signals: weather.signals,
    seed: weather.seed,
    time: weatherTime,
    intensity: .42 + reveal * .38 + finale * .2,
    reducedMotion: options.reducedMotion ?? false,
    motionCue: weatherMotionCue(weather, frames, Math.min(time, 3.1)),
  });
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  const glow = ctx.createRadialGradient(canvas.width * .5, canvas.height * .43, 0, canvas.width * .5, canvas.height * .43, canvas.width * (.28 + finale * .22));
  glow.addColorStop(0, `${palette.accent}${finale > .5 ? "55" : "2b"}`); glow.addColorStop(.45, `${palette.primary}20`); glow.addColorStop(1, `${palette.dark}00`);
  ctx.fillStyle = glow; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.restore();
  if (time < .6) { ctx.fillStyle = `rgba(3,5,8,${1 - reveal})`; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  if (finale > 0) {
    ctx.save(); ctx.globalCompositeOperation = "screen";
    const flare = ctx.createRadialGradient(canvas.width * .5, canvas.height * .43, 0, canvas.width * .5, canvas.height * .43, canvas.width * .8);
    flare.addColorStop(0, `${palette.accent}${Math.round(finale * 42).toString(16).padStart(2, "0")}`); flare.addColorStop(1, `${palette.primary}00`);
    ctx.fillStyle = flare; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.restore();
  }
  if (options.typography === false || time < 3.1) return;
  const typeIn = smoothstep((time - 3.1) / .35); ctx.save(); ctx.globalAlpha = typeIn;
  const shade = ctx.createLinearGradient(0, canvas.height * .65, 0, canvas.height); shade.addColorStop(0, "rgba(3,5,8,0)"); shade.addColorStop(1, "rgba(3,5,8,.66)");
  ctx.fillStyle = shade; ctx.fillRect(0, canvas.height * .6, canvas.width, canvas.height * .4); ctx.textAlign = "center"; ctx.shadowColor = "rgba(0,0,0,.75)"; ctx.shadowBlur = 22;
  ctx.fillStyle = "rgba(238,245,242,.8)"; ctx.font = "12px monospace"; ctx.fillText("TRANCEWEEKEND / RAVE WEATHER", canvas.width / 2, 1022);
  const name = weatherNameZh(weather), nameSize = fitText(ctx, name, 620, 68);
  ctx.font = `500 ${nameSize}px 'PingFang SC','Microsoft YaHei',sans-serif`; ctx.fillStyle = "#f4f7f5"; ctx.fillText(name, canvas.width / 2, 1102);
  ctx.fillStyle = "rgba(221,232,231,.78)"; ctx.font = "14px monospace"; ctx.fillText(weather.name, canvas.width / 2, 1141);
  ctx.fillStyle = "rgba(245,248,246,.9)"; ctx.font = "20px 'PingFang SC','Microsoft YaHei',sans-serif";
  wrapText(ctx, weatherQuoteZh(weather), 590).forEach((lineText, index) => ctx.fillText(lineText, canvas.width / 2, 1191 + index * 30));
  ctx.restore();
}

export function createWeatherShareCanvas() { const canvas = document.createElement("canvas"); canvas.width = WEATHER_SHARE_WIDTH; canvas.height = WEATHER_SHARE_HEIGHT; return canvas; }

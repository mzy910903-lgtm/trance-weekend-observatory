"use client";
import { useEffect, useRef } from "react";
import type { Phase, Signals, WeatherVisualKind } from "./weather";
import type { BeatState, ComboState, GestureEvent } from "./interaction";
import { drawWeatherScene } from "./WeatherRenderer";

// A deterministic field of fine, luminous filaments. No images or camera frames.
export function drawAtmosphere(canvas: HTMLCanvasElement, time: number, signals: Signals, phase: Phase, seed: number, visualKind?: WeatherVisualKind, reducedMotion = false) {
  if (visualKind) {
    drawWeatherScene(canvas, { kind: visualKind, signals, seed, time, intensity: 1, reducedMotion });
    return;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width, h = canvas.height;
  ctx.fillStyle = "#080a0c"; ctx.fillRect(0, 0, w, h);
  const closing = phase === "CLOSING";
  const hue = closing ? 29 : phase === "DEEP" ? 216 : 203;
  const glow = ctx.createRadialGradient(w * .5, h * .5, 0, w * .5, h * .5, w * .46);
  glow.addColorStop(0, `hsla(${hue},28%,38%,.18)`); glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
  const speed = phase === "WARM UP" ? .35 : phase === "BUILD" ? 1.1 : .65;
  const t = time * (.08 + signals.movement / 500) * speed;
  const release = (100 - signals.pressure) / 100;
  const radius = Math.min(w * .32, h * .42) * (.85 + signals.openness / 320 + release * .08);
  ctx.globalCompositeOperation = "screen";
  const count = phase === "PEAK" ? 14500 : 10000;
  for (let i = 0; i < count; i++) {
    const a = i * 2.39996323 + seed * .00001;
    const r = Math.sqrt((i % 1700) / 1700);
    const wave = Math.sin(a * 3 + t + r * 9) * .1 + Math.cos(a * 5 - t * .8) * .045;
    const rr = r + wave * Math.sin(r * Math.PI);
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    const warp = Math.sin(y * 6 + t) * .13 + Math.cos(x * 7 - t * .7) * .06;
    const px = w / 2 + (x + warp) * radius * 1.22;
    const py = h * (.46 + release * .065) + (y * .77 + Math.sin(x * 5 + t) * .16) * radius;
    const light = 48 + 30 * Math.pow(Math.sin(a * 2 + r * 12 + t), 2);
    ctx.fillStyle = `hsla(${hue + Math.sin(a) * 12},${closing ? 23 : 18}%,${light}%,${.12 + (1-r) * .35})`;
    const size = Math.max(.65, w / 1500) * (1 + (i % 3) * .25);
    ctx.fillRect(px, py, size, size);
  }
  ctx.globalCompositeOperation = "source-over";
}
export default function Atmosphere({ signals, phase, seed = 42, visualKind, transitionProgress = 0, sessionProgress = 0, beatState, comboState, lastGesture }: { signals: Signals; phase: Phase; seed?: number; visualKind?: WeatherVisualKind; transitionProgress?: number; sessionProgress?: number; beatState?: BeatState; comboState?: ComboState; lastGesture?: GestureEvent | null }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const live = useRef({ signals, phase, seed, visualKind, transitionProgress, sessionProgress, beatState, comboState, lastGesture });
  useEffect(() => { live.current = { signals, phase, seed, visualKind, transitionProgress, sessionProgress, beatState, comboState, lastGesture }; }, [signals, phase, seed, visualKind, transitionProgress, sessionProgress, beatState, comboState, lastGesture]);
  useEffect(() => {
    const el = canvas.current!;
    let frame = 0, last = 0;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const resize = () => { el.width = Math.min(1600, el.clientWidth * devicePixelRatio); el.height = Math.min(1200, el.clientHeight * devicePixelRatio); };
    const observer = new ResizeObserver(resize); observer.observe(el); resize();
    const render = (now: number) => {
      if (now - last > (reduced ? 250 : 32)) {
        const p = live.current;
        const sessionEnergy = reduced ? p.sessionProgress * .32 : p.sessionProgress;
        const beatAge = p.beatState ? now - p.beatState.lastBeatAt : 999;
        const beatPulse = beatAge >= 0 && beatAge < 240 ? 1 - beatAge / 240 : 0;
        const comboEnergy = (p.comboState?.energy || 0) / 100;
        const gestureAge = p.lastGesture ? now - p.lastGesture.at : 9999;
        const openPulse = p.lastGesture?.kind === "open" && gestureAge < 750 ? 1 - gestureAge / 750 : 0;
        const charge = Math.max(0, Math.min(1, (p.transitionProgress - .775) / .125));
        const burst = Math.max(0, Math.min(1, (p.transitionProgress - .9) / .1));
        const stageSignals = {
          ...p.signals,
          movement: Math.max(p.signals.movement, 12 + sessionEnergy * 48 + comboEnergy * 20 + beatPulse * 18),
          openness: Math.max(p.signals.openness, 20 + sessionEnergy * 35 + openPulse * 32),
          pressure: p.signals.pressure * (1 - sessionEnergy * .18),
        };
        const renderedSignals = p.transitionProgress > 0 ? {
          ...stageSignals,
          movement: stageSignals.movement + (100 - stageSignals.movement) * Math.max(charge, burst),
          openness: burst > 0 ? stageSignals.openness + (100 - stageSignals.openness) * burst : stageSignals.openness * (1 - charge * .82),
          pressure: burst > 0 ? stageSignals.pressure * (1 - burst) : stageSignals.pressure + (100 - stageSignals.pressure) * charge,
        } : stageSignals;
        drawAtmosphere(el, reduced ? 0 : now / 1000, renderedSignals, p.phase, p.seed, p.visualKind, reduced);
        last = now;
      }
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, []);
  return <canvas className="rw-atmosphere" ref={canvas} aria-label="根据动作生成的霓虹天气" />;
}

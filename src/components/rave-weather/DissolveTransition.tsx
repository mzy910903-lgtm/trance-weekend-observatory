"use client";

import { useEffect, useMemo, useRef } from "react";
import { weatherConflict, weatherDefinition, weatherNameZh, weatherVisualKind, type Weather } from "./weather";
import { drawWeatherScene, weatherPalettes } from "./WeatherRenderer";

type Props = {
  elapsed: number;
  duration: number;
  snapshot: ImageBitmap | null;
  weather: Weather;
};

type Particle = { x: number; y: number; angle: number; radius: number; size: number; light: number };

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const mix = (from: number, to: number, amount: number) => from + (to - from) * amount;
const REVEAL_REFERENCE_SECONDS = 7;
const revealPoint = (seconds: number) => seconds / REVEAL_REFERENCE_SECONDS;
const revealProgress = (progress: number, start: number, end: number) => clamp01((progress - revealPoint(start)) / (revealPoint(end) - revealPoint(start)));

function createParticles(seed: number) {
  let state = seed || 1;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  return Array.from({ length: 520 }, (): Particle => ({
    x: random(),
    y: random(),
    angle: random() * Math.PI * 2,
    radius: Math.sqrt(random()),
    size: .45 + random() * 1.8,
    light: 55 + random() * 32,
  }));
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  width: number,
  height: number,
  offsetX = 0,
) {
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = width / height;
  let cropWidth = sourceWidth;
  let cropHeight = sourceHeight;
  let cropX = 0;
  let cropY = 0;
  if (sourceRatio > targetRatio) {
    cropWidth = sourceHeight * targetRatio;
    cropX = (sourceWidth - cropWidth) / 2;
  } else {
    cropHeight = sourceWidth / targetRatio;
    cropY = (sourceHeight - cropHeight) / 2;
  }
  ctx.drawImage(source, cropX, cropY, cropWidth, cropHeight, offsetX, 0, width, height);
}

export default function DissolveTransition({ elapsed, duration, snapshot, weather }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useMemo(() => createParticles(weather.seed), [weather.seed]);
  const kind = weatherVisualKind(weather);
  const dissolveStyle = weatherDefinition(kind).dissolveStyle;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.min(devicePixelRatio, 1.5);
    const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
    const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const progress = clamp01(elapsed / duration);
    const visualTime = progress * 8;
    const dissolve = revealProgress(progress, .8, 3);
    const charge = revealProgress(progress, 5.3, 6.3);
    const burst = revealProgress(progress, 6.3, 7);
    const renderedDissolve = reduced ? (progress >= revealPoint(3) ? 1 : 0) : dissolve;
    const renderedCharge = reduced ? 0 : charge;
    const renderedBurst = reduced ? 0 : burst;
    const cloudAlpha = snapshot ? revealProgress(progress, .55, 2.4) : revealProgress(progress, 0, 1.05);
    drawWeatherScene(canvas, { kind, signals: weather.signals, seed: weather.seed, time: visualTime, intensity: .45 + cloudAlpha * .55, reducedMotion: reduced });

    if (snapshot && progress < revealPoint(3.3)) {
      const calm = ["pressure", "fog", "current"].includes(dissolveStyle);
      const radial = ["rays", "sunrise", "spectrum", "aurora"].includes(dissolveStyle);
      const strips = reduced || calm ? 1 : radial ? 22 : 38;
      ctx.globalAlpha = 1 - renderedDissolve * .88;
      for (let i = 0; i < strips; i++) {
        const y = height * i / strips;
        const stripHeight = height / strips + 1;
        const direction = radial ? Math.sign(i - strips / 2) : ["rain", "inversion", "heat"].includes(dissolveStyle) ? 1 : i % 2 ? 1 : -1;
        const amount = ["shards", "vortex", "wind"].includes(dissolveStyle) ? .13 : dissolveStyle === "lightning" ? .08 : .045;
        const offset = reduced ? 0 : direction * (Math.sin(i * 1.73 + weather.seed) * amount + amount * .35) * width * renderedDissolve;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, y, width, stripHeight);
        ctx.clip();
        drawCover(ctx, snapshot, snapshot.width, snapshot.height, width, height, offset);
        ctx.restore();
      }
      const shade = ctx.createRadialGradient(width * .5, height * .46, 0, width * .5, height * .46, width * .68);
      shade.addColorStop(0, `rgba(7,9,10,${.12 + renderedDissolve * .2})`);
      shade.addColorStop(1, `rgba(2,3,4,${.65 + renderedDissolve * .3})`);
      ctx.globalAlpha = 1;
      ctx.fillStyle = shade;
      ctx.fillRect(0, 0, width, height);
      if (["pressure", "fog", "current"].includes(dissolveStyle)) {
        const fog = ctx.createLinearGradient(0, height * (.2 + renderedDissolve * .25), 0, height * .82);
        fog.addColorStop(0, "rgba(48,78,126,0)"); fog.addColorStop(.45, `rgba(66,94,145,${renderedDissolve * .45})`); fog.addColorStop(1, "rgba(4,8,16,.9)");
        ctx.fillStyle = fog; ctx.fillRect(0, 0, width, height);
      }
    }

    const palette = weatherPalettes[kind];
    ctx.globalCompositeOperation = "screen";
    for (const particle of particles) {
      const originX = particle.x * width;
      const originY = particle.y * height;
      const targetRadius = particle.radius * Math.min(width, height) * .42;
      const targetX = width * .5 + Math.cos(particle.angle + visualTime * .13) * targetRadius * 1.35;
      const targetY = height * .49 + Math.sin(particle.angle + visualTime * .1) * targetRadius * .72;
      let x = mix(originX, targetX, renderedDissolve);
      let y = mix(originY, targetY, renderedDissolve);
      if (renderedCharge > 0) {
        x = mix(x, width * .5, renderedCharge * .68);
        y = mix(y, height * .49, renderedCharge * .68);
      }
      if (renderedBurst > 0) {
        const force = renderedBurst * Math.min(width, height) * (.2 + particle.radius * .58);
        x += Math.cos(particle.angle) * force;
        y += Math.sin(particle.angle) * force * .65;
      }
      ctx.strokeStyle = particle.light > 70 ? palette.accent : particle.angle % 2 > 1 ? palette.primary : palette.secondary;
      ctx.fillStyle = ctx.strokeStyle;
      ctx.globalAlpha = cloudAlpha * (.12 + particle.radius * .3);
      const size = particle.size * ratio * (1 + renderedBurst * 1.5);
      if (["shards", "vortex", "wind"].includes(dissolveStyle)) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + size * 4, y - size); ctx.lineTo(x + size * 2, y + size * 2.5); ctx.closePath(); ctx.fill();
      } else if (["rays", "sunrise", "aurora"].includes(dissolveStyle)) {
        ctx.lineWidth = size; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - size * 9); ctx.stroke();
      } else if (["pressure", "fog", "current"].includes(dissolveStyle)) {
        ctx.lineWidth = Math.max(.5, size * .45); ctx.beginPath(); ctx.ellipse(x, y, size * 4, size, 0, 0, Math.PI * 2); ctx.stroke();
      } else if (dissolveStyle === "spectrum") {
        ctx.globalAlpha *= .8; ctx.fillStyle = `hsl(${(particle.angle * 57.3 + visualTime * 45) % 360} 95% 68%)`; ctx.beginPath(); ctx.arc(x, y, size * 1.7, 0, Math.PI * 2); ctx.fill();
      } else if (dissolveStyle === "heat") {
        ctx.lineWidth = Math.max(.7, size); ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + size * 5, y - size * 5, x, y - size * 11); ctx.stroke();
      } else {
        const slant = dissolveStyle === "rain" ? .55 : dissolveStyle === "inversion" ? -.15 : -.25;
        ctx.lineWidth = Math.max(.7, size * .55); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + size * 6 * slant, y + size * 7); ctx.stroke();
      }
    }
    if (["lightning", "vortex", "aurora"].includes(dissolveStyle) && !reduced && renderedDissolve > .35 && renderedDissolve < .9) {
      ctx.globalAlpha = Math.sin(renderedDissolve * Math.PI) * .28;
      ctx.fillStyle = palette.accent; ctx.fillRect(0, 0, width, height);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }, [dissolveStyle, duration, elapsed, kind, particles, snapshot, weather.seed, weather.signals]);

  const conflict = weatherConflict(weather);
  const progress = clamp01(elapsed / duration);
  const stage = progress < revealPoint(.8) ? "freeze" : progress < revealPoint(3) ? "dissolve" : progress < revealPoint(4.1) ? "setup" : progress < revealPoint(5.3) ? "payoff" : progress < revealPoint(6.3) ? "charge" : "impact";
  const status = progress < revealPoint(3) ? "正在把你从画面里拿走" : progress < revealPoint(5.3) ? "天气正在形成" : "系统即将给出意见";

  return <div className={`rw-transition rw-transition-${stage}`} role="status" aria-live="assertive">
    <canvas ref={canvasRef} aria-hidden="true" />
    <div className="rw-transition-grain" />
    {stage === "setup" && <p>{conflict.setup}</p>}
    {stage === "payoff" && <p className="rw-transition-payoff">{conflict.payoff}</p>}
    {stage === "impact" && <div className="rw-transition-name"><span>你的内在天气</span><h2>{weatherNameZh(weather)}</h2><b>{weather.name}</b></div>}
    {stage !== "impact" && <div className="rw-transition-status"><span>{status}</span><b>WEATHER FORMING</b><div><i style={{ width: `${progress * 100}%` }} /></div><em>{String(Math.round(progress * 100)).padStart(2, "0")}%</em></div>}
  </div>;
}

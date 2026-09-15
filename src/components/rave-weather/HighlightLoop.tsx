"use client";
import { useEffect, useRef, useState } from "react";
import type { HighlightData } from "./interaction";
import type { Weather } from "./weather";
import { drawWeatherShareFrame } from "./WeatherShareRenderer";

export default function HighlightLoop({ highlight, weather, replayKey = 0 }: { highlight: HighlightData; weather: Weather; replayKey?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [finished, setFinished] = useState(false);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    let frame = 0, last = 0;
    const startedAt = performance.now();
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    setFinished(false);
    const resize = () => {
      const ratio = Math.min(devicePixelRatio, 1.5);
      element.width = Math.max(1, Math.round(element.clientWidth * ratio));
      element.height = Math.max(1, Math.round(element.clientHeight * ratio));
    };
    const observer = new ResizeObserver(resize); observer.observe(element); resize();
    const render = (now: number) => {
      if (now - last >= 40) {
        const elapsed = (now - startedAt) / 1000;
        drawWeatherShareFrame(element, weather, Math.min(elapsed, 4 - 1 / highlight.fps), { typography: false, reducedMotion: reduced });
        if (elapsed >= 4) setFinished(true);
        last = now;
      }
      if ((now - startedAt) / 1000 < 4.8) frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [highlight.fps, replayKey, weather]);
  return <canvas className={`rw-highlight-loop ${finished ? "finished" : ""}`} ref={canvas} aria-label="4 秒专属天气" />;
}

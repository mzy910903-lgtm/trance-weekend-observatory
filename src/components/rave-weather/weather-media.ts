"use client";

import type { Weather } from "./weather";
import { createWeatherShareCanvas, drawWeatherShareFrame, WEATHER_SHARE_SECONDS } from "./WeatherShareRenderer";

export type PreparedWeatherMedia = {
  blob: Blob;
  extension: "mp4" | "webm" | "png";
  mimeType: "video/mp4" | "video/webm" | "image/png";
};

export function weatherMediaFilename(weather: Pick<Weather, "name">) {
  return `${weather.name.toLowerCase().replaceAll(" ", "-") || "rave-weather"}-weather`;
}

export function downloadWeatherMedia(media: PreparedWeatherMedia, weather: Pick<Weather, "name">) {
  const url = URL.createObjectURL(media.blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${weatherMediaFilename(weather)}.${media.extension}`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function createWeatherCover(weather: Weather) {
  const canvas = createWeatherShareCanvas();
  drawWeatherShareFrame(canvas, weather, 3.45, { typography: true, reducedMotion: false });
  return new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
}

export async function recordWeatherVideo(weather: Weather): Promise<PreparedWeatherMedia | null> {
  if (typeof MediaRecorder === "undefined" || typeof HTMLCanvasElement.prototype.captureStream !== "function") return null;
  const canvas = createWeatherShareCanvas();
  const stream = canvas.captureStream(25);
  const requestedMimeType = [
    "video/mp4;codecs=avc1.42E01E",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ].find(type => MediaRecorder.isTypeSupported(type)) || "";
  try {
    const recorder = new MediaRecorder(stream, requestedMimeType
      ? { mimeType: requestedMimeType, videoBitsPerSecond: 6_000_000 }
      : { videoBitsPerSecond: 6_000_000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    const finished = new Promise<Blob>((resolve, reject) => {
      recorder.onerror = () => reject(new Error("recording failed"));
      recorder.onstop = () => {
        const recordedType = recorder.mimeType || requestedMimeType;
        const normalizedType: PreparedWeatherMedia["mimeType"] = recordedType.startsWith("video/mp4") ? "video/mp4" : "video/webm";
        resolve(new Blob(chunks, { type: normalizedType }));
      };
    });
    drawWeatherShareFrame(canvas, weather, 0, { typography: true, reducedMotion: false });
    recorder.start(100);
    await new Promise(resolve => setTimeout(resolve, 120));
    const startedAt = performance.now();
    await new Promise<void>(resolve => {
      const render = (now: number) => {
        const elapsed = Math.min(WEATHER_SHARE_SECONDS, (now - startedAt) / 1000);
        drawWeatherShareFrame(canvas, weather, elapsed, { typography: true, reducedMotion: false });
        if (elapsed >= WEATHER_SHARE_SECONDS) { resolve(); return; }
        requestAnimationFrame(render);
      };
      requestAnimationFrame(render);
    });
    recorder.requestData();
    await new Promise(resolve => setTimeout(resolve, 420));
    recorder.stop();
    const blob = await finished;
    if (blob.size < 1_024) throw new Error("empty recording");
    const isMp4 = blob.type === "video/mp4";
    return { blob, extension: isMp4 ? "mp4" : "webm", mimeType: isMp4 ? "video/mp4" : "video/webm" };
  } finally {
    stream.getTracks().forEach(track => track.stop());
  }
}

export async function prepareWeatherMedia(weather: Weather): Promise<{ media: PreparedWeatherMedia; fallback: boolean }> {
  try {
    const video = await recordWeatherVideo(weather);
    if (video) return { media: video, fallback: false };
  } catch {
    // Continue to the weather-cover fallback.
  }
  const cover = await createWeatherCover(weather);
  if (!cover) throw new Error("weather media unavailable");
  return { media: { blob: cover, extension: "png", mimeType: "image/png" }, fallback: true };
}

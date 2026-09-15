"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { emptyBeat, type BeatState } from "./interaction";

export function useBeat() {
  const [state, setState] = useState<BeatState>(emptyBeat);
  const live = useRef<BeatState>({ ...emptyBeat });
  const resources = useRef<{ stream?: MediaStream; context?: AudioContext; frame?: number }>({});
  const generation = useRef(0);

  const publish = useCallback((next: BeatState) => { live.current = next; setState(next); }, []);
  const stop = useCallback(() => {
    generation.current++;
    if (resources.current.frame) cancelAnimationFrame(resources.current.frame);
    resources.current.stream?.getTracks().forEach(track => track.stop());
    void resources.current.context?.close();
    resources.current = {};
    publish({ ...emptyBeat });
  }, [publish]);
  useEffect(() => stop, [stop]);

  const startFallback = useCallback((token: number) => {
    let last = 0, lastPublish = 0;
    const tick = (now: number) => {
      if (generation.current !== token) return;
      if (!last || now - last >= 500) last = now;
      if (now - lastPublish >= 50) {
        const phase = (now - last) / 500;
        publish({ status: "fallback", source: "fallback", lastBeatAt: last, lowEnergy: Math.max(0, 1 - phase * 4), bpm: 120, confidence: 0 });
        lastPublish = now;
      }
      resources.current.frame = requestAnimationFrame(tick);
    };
    resources.current.frame = requestAnimationFrame(tick);
  }, [publish]);

  const start = useCallback(async () => {
    stop();
    const token = generation.current;
    publish({ ...emptyBeat, status: "permission" });
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
      if (generation.current !== token) { stream.getTracks().forEach(track => track.stop()); return; }
      const context = new AudioContext();
      await context.resume();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = .32;
      source.connect(analyser);
      resources.current = { stream, context };
      const bins = new Uint8Array(analyser.frequencyBinCount);
      const intervals: number[] = [];
      let baseline = .08, previous = 0, lastBeatAt = 0, lastPublish = 0;
      const tick = (now: number) => {
        if (generation.current !== token) return;
        analyser.getByteFrequencyData(bins);
        const hzPerBin = context.sampleRate / analyser.fftSize;
        const startBin = Math.max(1, Math.floor(40 / hzPerBin));
        const endBin = Math.min(bins.length, Math.ceil(180 / hzPerBin));
        let total = 0;
        for (let index = startBin; index < endBin; index++) total += bins[index];
        const low = total / Math.max(1, endBin - startBin) / 255;
        baseline += (low - baseline) * (low > baseline ? .012 : .045);
        const flux = Math.max(0, low - previous); previous = low;
        if (now - lastBeatAt > 240 && low > Math.max(.11, baseline * 1.22) && flux > .018) {
          if (lastBeatAt) {
            const interval = now - lastBeatAt;
            if (interval >= 333 && interval <= 857) { intervals.push(interval); if (intervals.length > 12) intervals.shift(); }
          }
          lastBeatAt = now;
        }
        if (now - lastPublish > 50) {
          const sorted = [...intervals].sort((a, b) => a - b);
          const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 500;
          const bpm = Math.round(60000 / median);
          const confidence = Math.min(1, intervals.length / 6) * (now - lastBeatAt < 1800 ? 1 : .25);
          publish({ status: "listening", source: "microphone", lastBeatAt, lowEnergy: low, bpm, confidence });
          lastPublish = now;
        }
        resources.current.frame = requestAnimationFrame(tick);
      };
      resources.current.frame = requestAnimationFrame(tick);
    } catch {
      if (generation.current !== token) return;
      startFallback(token);
    }
  }, [publish, startFallback, stop]);

  const startVisualFallback = useCallback(() => {
    stop();
    startFallback(generation.current);
  }, [startFallback, stop]);

  return { state, live, start, startVisualFallback, stop };
}

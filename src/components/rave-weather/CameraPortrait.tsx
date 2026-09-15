"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, type RefObject } from "react";
import type { Phase, Signals } from "./weather";
import type { PoseVisualPoint, PoseVisualVelocity, PoseVisuals } from "./usePose";
import type { BeatState, ComboState, GestureEvent } from "./interaction";

export type CameraPortraitHandle = {
  captureFrame: () => Promise<ImageBitmap | null>;
};

type Props = {
  sourceRef: RefObject<HTMLVideoElement | null>;
  signals: Signals;
  visuals: RefObject<PoseVisuals>;
  present: boolean;
  phase: Phase;
  sessionIntensity: number;
  beatState: BeatState;
  comboState: ComboState;
  lastGesture: GestureEvent | null;
};

type CanvasPoint = { x: number; y: number };

function coverCrop(video: HTMLVideoElement, width: number, height: number) {
  const sourceRatio = video.videoWidth / video.videoHeight;
  const targetRatio = width / height;
  let sourceWidth = video.videoWidth;
  let sourceHeight = video.videoHeight;
  let sourceX = 0;
  let sourceY = 0;
  if (sourceRatio > targetRatio) {
    sourceWidth = video.videoHeight * targetRatio;
    sourceX = (video.videoWidth - sourceWidth) / 2;
  } else {
    sourceHeight = video.videoWidth / targetRatio;
    sourceY = (video.videoHeight - sourceHeight) / 2;
  }
  return { sourceX, sourceY, sourceWidth, sourceHeight };
}

function drawCover(ctx: CanvasRenderingContext2D, video: HTMLVideoElement, width: number, height: number) {
  const crop = coverCrop(video, width, height);
  ctx.drawImage(video, crop.sourceX, crop.sourceY, crop.sourceWidth, crop.sourceHeight, 0, 0, width, height);
}

function mapPoint(video: HTMLVideoElement, width: number, height: number, point: PoseVisualPoint | null): CanvasPoint | null {
  if (!point) return null;
  const crop = coverCrop(video, width, height);
  return {
    x: width - (point.x * video.videoWidth - crop.sourceX) / crop.sourceWidth * width,
    y: (point.y * video.videoHeight - crop.sourceY) / crop.sourceHeight * height,
  };
}

function mapVelocity(video: HTMLVideoElement, width: number, height: number, velocity: PoseVisualVelocity): CanvasPoint {
  const crop = coverCrop(video, width, height);
  return {
    x: -velocity.x * video.videoWidth / crop.sourceWidth * width,
    y: velocity.y * video.videoHeight / crop.sourceHeight * height,
  };
}

function pseudo(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function drawBolt(
  ctx: CanvasRenderingContext2D,
  from: CanvasPoint,
  to: CanvasPoint,
  color: string,
  alpha: number,
  seed: number,
  branches = true,
) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const normalX = -dy / length;
  const normalY = dx / length;
  const points = Array.from({ length: 10 }, (_, index) => {
    const progress = index / 9;
    const edgeFade = Math.sin(progress * Math.PI);
    const jitter = (pseudo(seed + index * 7.17) - .5) * length * .12 * edgeFade;
    return { x: from.x + dx * progress + normalX * jitter, y: from.y + dy * progress + normalY * jitter };
  });
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha * .3;
  ctx.lineWidth = 5;
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;
  ctx.beginPath();
  points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
  ctx.stroke();
  ctx.globalAlpha = alpha;
  ctx.lineWidth = 1.15;
  ctx.shadowBlur = 5;
  ctx.stroke();
  if (branches) {
    for (const index of [3, 6]) {
      const start = points[index];
      const direction = pseudo(seed + index * 19) > .5 ? 1 : -1;
      ctx.globalAlpha = alpha * .55;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(start.x + normalX * length * .11 * direction + dx * .08, start.y + normalY * length * .11 * direction + dy * .08);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawLivingBolt(
  ctx: CanvasRenderingContext2D,
  from: CanvasPoint,
  to: CanvasPoint,
  color: string,
  alpha: number,
  now: number,
  seed: number,
  branches = true,
) {
  const interval = 100;
  const bucket = Math.floor(now / interval);
  const blend = (now % interval) / interval;
  drawBolt(ctx, from, to, color, alpha * (1 - blend), seed + bucket * 31, branches);
  drawBolt(ctx, from, to, color, alpha * blend, seed + (bucket + 1) * 31, branches);
}

const CameraPortrait = forwardRef<CameraPortraitHandle, Props>(function CameraPortrait(
  { sourceRef, signals, visuals, present, phase, sessionIntensity, beatState, comboState, lastGesture },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = useRef({ signals, present, phase, sessionIntensity, beatState, comboState, lastGesture });

  useEffect(() => { live.current = { signals, present, phase, sessionIntensity, beatState, comboState, lastGesture }; }, [signals, present, phase, sessionIntensity, beatState, comboState, lastGesture]);

  useImperativeHandle(ref, () => ({
    async captureFrame() {
      const canvas = canvasRef.current;
      if (!canvas || canvas.width === 0 || canvas.height === 0 || typeof createImageBitmap !== "function") return null;
      try { return await createImageBitmap(canvas); } catch { return null; }
    },
  }), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const base = document.createElement("canvas");
    const baseCtx = base.getContext("2d", { alpha: false });
    const edgeSource = document.createElement("canvas");
    const edgeSourceCtx = edgeSource.getContext("2d", { willReadFrequently: true });
    const edgeGlow = document.createElement("canvas");
    const edgeGlowCtx = edgeGlow.getContext("2d");
    const history = Array.from({ length: 5 }, () => document.createElement("canvas"));
    const historyContexts = history.map(item => item.getContext("2d", { alpha: false }));
    if (!baseCtx || !edgeSourceCtx || !edgeGlowCtx || historyContexts.some(item => !item)) return;

    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const particles = Array.from({ length: 120 }, (_, index) => ({
      angle: index * 2.39996323,
      radius: .18 + ((index * 47) % 83) / 100,
      phase: ((index * 71) % 101) / 101 * Math.PI * 2,
      size: .7 + (index % 4) * .35,
    }));
    const phaseSpeed: Record<Phase, number> = { "WARM UP": .72, DEEP: .46, BUILD: 1.05, PEAK: 1.3, CLOSING: .38 };
    let frame = 0;
    let last = 0;
    let grainSeed = 17;
    let historyIndex = 0;
    let historyCount = 0;
    let presence = 0;
    let nextShock = 0;
    const shocks: Array<{ startedAt: number; x: number; y: number }> = [];

    const resize = () => {
      const ratio = Math.min(devicePixelRatio, 1.35);
      const width = Math.max(1, Math.min(900, Math.round(canvas.clientWidth * ratio)));
      const height = Math.max(1, Math.min(1050, Math.round(canvas.clientHeight * ratio)));
      canvas.width = width;
      canvas.height = height;
      base.width = width;
      base.height = height;
      for (const item of history) { item.width = width; item.height = height; }
      edgeSource.width = 180;
      edgeSource.height = Math.max(1, Math.round(180 * height / width));
      edgeGlow.width = edgeSource.width;
      edgeGlow.height = edgeSource.height;
      historyCount = 0;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const drawEdges = (width: number, height: number) => {
      try {
        edgeSourceCtx.clearRect(0, 0, edgeSource.width, edgeSource.height);
        edgeSourceCtx.drawImage(base, 0, 0, edgeSource.width, edgeSource.height);
        const source = edgeSourceCtx.getImageData(0, 0, edgeSource.width, edgeSource.height);
        const output = edgeGlowCtx.createImageData(edgeGlow.width, edgeGlow.height);
        const w = edgeSource.width;
        for (let y = 0; y < edgeSource.height - 1; y++) {
          for (let x = 0; x < w - 1; x++) {
            const index = (y * w + x) * 4;
            const right = index + 4;
            const below = index + w * 4;
            const luminance = source.data[index] * .299 + source.data[index + 1] * .587 + source.data[index + 2] * .114;
            const rightLuminance = source.data[right] * .299 + source.data[right + 1] * .587 + source.data[right + 2] * .114;
            const belowLuminance = source.data[below] * .299 + source.data[below + 1] * .587 + source.data[below + 2] * .114;
            const strength = Math.min(255, Math.max(0, Math.abs(luminance - rightLuminance) + Math.abs(luminance - belowLuminance) - 23) * 3.2);
            output.data[index] = x < w * .52 ? 45 : 255;
            output.data[index + 1] = x < w * .52 ? 222 : 70;
            output.data[index + 2] = x < w * .52 ? 255 : 206;
            output.data[index + 3] = strength;
          }
        }
        edgeGlowCtx.putImageData(output, 0, 0);
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = .24 + presence * .42;
        ctx.filter = `blur(${2 + presence * 2}px)`;
        ctx.drawImage(edgeGlow, 0, 0, width, height);
        ctx.restore();
      } catch {
        // A missing edge layer should never interrupt the live preview.
      }
    };

    const draw = (now: number) => {
      if (now - last > 40) {
        last = now;
        const video = sourceRef.current;
        const { width, height } = canvas;
        const current = live.current;
        const movement = reduced ? 0 : Math.max(0, Math.min(1, current.signals.movement / 100));
        const openness = Math.max(0, Math.min(1, current.signals.openness / 100));
        const stillness = Math.max(0, Math.min(1, current.signals.stillness / 100));
        const comboBoost = Math.min(1, current.comboState.energy / 100);
        const beatAge = now - current.beatState.lastBeatAt;
        const beatPulse = beatAge >= 0 && beatAge < 220 ? 1 - beatAge / 220 : 0;
        const intensity = Math.max(.15, Math.min(1, current.sessionIntensity + comboBoost * .22 + beatPulse * .15));
        const speed = phaseSpeed[current.phase] * (.72 + intensity * .55);
        presence += ((current.present ? 1 : 0) - presence) * .075;
        const breath = .5 + Math.sin(now * .0014 * speed) * .5;
        const pose = visuals.current;
        const readableVideo = video && video.readyState >= 2 && video.videoWidth > 0 ? video : null;
        const nose = readableVideo ? mapPoint(readableVideo, width, height, pose.nose) : null;
        const shoulderCenter = readableVideo ? mapPoint(readableVideo, width, height, pose.shoulderCenter) : null;
        const leftShoulder = readableVideo ? mapPoint(readableVideo, width, height, pose.leftShoulder) : null;
        const rightShoulder = readableVideo ? mapPoint(readableVideo, width, height, pose.rightShoulder) : null;
        const leftWrist = readableVideo ? mapPoint(readableVideo, width, height, pose.leftWrist) : null;
        const rightWrist = readableVideo ? mapPoint(readableVideo, width, height, pose.rightWrist) : null;
        const center = shoulderCenter ?? { x: width * .5, y: height * .47 };
        const shoulderSpan = leftShoulder && rightShoulder ? Math.abs(leftShoulder.x - rightShoulder.x) : width * .24;

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
        ctx.filter = "none";
        ctx.fillStyle = "#071018";
        ctx.fillRect(0, 0, width, height);

        if (video && video.readyState >= 2 && video.videoWidth > 0) {
          baseCtx.setTransform(1, 0, 0, 1, 0, 0);
          baseCtx.globalAlpha = 1;
          baseCtx.globalCompositeOperation = "source-over";
          baseCtx.filter = "none";
          baseCtx.fillStyle = "#0b1117";
          baseCtx.fillRect(0, 0, width, height);
          baseCtx.save();
          baseCtx.translate(width, 0);
          baseCtx.scale(-1, 1);
          baseCtx.filter = "saturate(78%) contrast(84%) brightness(91%) blur(11px)";
          baseCtx.globalAlpha = .58;
          baseCtx.save();
          baseCtx.translate(-width * .025, -height * .025);
          baseCtx.scale(1.05, 1.05);
          drawCover(baseCtx, video, width, height);
          baseCtx.restore();
          baseCtx.filter = "saturate(82%) contrast(96%) brightness(108%) blur(.75px)";
          baseCtx.globalAlpha = .91;
          drawCover(baseCtx, video, width, height);
          baseCtx.restore();

          const grade = baseCtx.createLinearGradient(0, height, width, 0);
          grade.addColorStop(0, "#14b9e4");
          grade.addColorStop(.48, "#d69a8b");
          grade.addColorStop(1, "#e32c98");
          baseCtx.globalCompositeOperation = "color";
          baseCtx.globalAlpha = .24;
          baseCtx.fillStyle = grade;
          baseCtx.fillRect(0, 0, width, height);
          baseCtx.globalCompositeOperation = "soft-light";
          baseCtx.globalAlpha = .42;
          baseCtx.fillRect(0, 0, width, height);
          baseCtx.globalCompositeOperation = "source-over";
          baseCtx.globalAlpha = 1;

          if (!reduced && historyCount > 0 && movement + intensity > .3) {
            const trailLayers = Math.min(historyCount, Math.max(2, Math.ceil(1 + movement * 2.4 + intensity * 1.7)));
            for (let i = 0; i < trailLayers; i++) {
              const index = (historyIndex - 1 - i + history.length) % history.length;
              const offset = (2 + movement * 13 + intensity * 4) * (i + 1);
              ctx.save();
              ctx.globalCompositeOperation = "screen";
              ctx.globalAlpha = (movement * .8 + intensity * .2) * Math.max(.03, .15 - i * .025);
              ctx.filter = `saturate(${145 + movement * 80}%) hue-rotate(${i % 2 ? 318 : 138}deg) blur(${1 + i * 1.2}px)`;
              ctx.translate((i % 2 ? -1 : 1) * offset, Math.sin(now * .006 + i) * offset * .22);
              ctx.drawImage(history[index], 0, 0);
              ctx.restore();
            }
          }

          ctx.globalAlpha = .94;
          ctx.drawImage(base, 0, 0);
          if (!reduced && movement + intensity > .35) {
            const split = 1 + movement * 7 + intensity * 2.5;
            ctx.save();
            ctx.globalCompositeOperation = "screen";
            ctx.globalAlpha = .018 + movement * .07 + intensity * .025;
            ctx.filter = "saturate(190%) hue-rotate(135deg)";
            ctx.drawImage(base, -split, 0);
            ctx.filter = "saturate(190%) hue-rotate(315deg)";
            ctx.drawImage(base, split, 0);
            ctx.restore();
          }

          if (!reduced && movement + intensity * .38 > .34) {
            const sliceSeed = Math.floor(now / 110);
            ctx.save();
            ctx.globalCompositeOperation = "screen";
            ctx.globalAlpha = (.025 + movement * .075) * (.55 + intensity * .55);
            for (let i = 0; i < 7; i++) {
              const y = pseudo(sliceSeed * 13 + i * 5.9) * height;
              const bandHeight = 2 + pseudo(sliceSeed + i * 17) * 10;
              if (nose && Math.abs(y - nose.y) < height * .13) continue;
              const direction = i % 2 ? -1 : 1;
              const offset = direction * (4 + movement * 18) * (.45 + pseudo(i + sliceSeed));
              ctx.drawImage(base, 0, y, width, bandHeight, offset, y, width, bandHeight);
            }
            ctx.restore();
          }

          drawEdges(width, height);

          if (!reduced) {
            const ringEnergy = .18 + openness * .53 + intensity * .38;
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            for (let i = 0; i < 4; i++) {
              const pulse = (now * .00022 * speed + i / 4) % 1;
              const radiusX = shoulderSpan * (.72 + pulse * (1.25 + openness * .7));
              const radiusY = radiusX * (.42 + openness * .14);
              ctx.globalAlpha = presence * ringEnergy * (1 - pulse) * (.32 + intensity * .28);
              ctx.strokeStyle = i % 2 ? "#ff52bd" : "#55e7ff";
              ctx.lineWidth = 1.35 + (1 - pulse) * 1.65;
              ctx.shadowColor = ctx.strokeStyle;
              ctx.shadowBlur = 10;
              ctx.beginPath();
              ctx.ellipse(center.x, center.y, radiusX, radiusY, Math.sin(now * .0003 + i) * .13, 0, Math.PI * 2);
              ctx.stroke();
            }
            ctx.restore();

            if (leftShoulder && rightShoulder) {
              drawLivingBolt(ctx, leftShoulder, rightShoulder, "#8defff", presence * (.24 + intensity * .35 + breath * .2), now, 11, false);
              const leftOuter = { x: leftShoulder.x + shoulderSpan * .7, y: leftShoulder.y + Math.sin(now * .002) * 8 };
              const rightOuter = { x: rightShoulder.x - shoulderSpan * .7, y: rightShoulder.y - Math.sin(now * .002) * 8 };
              drawLivingBolt(ctx, leftShoulder, leftOuter, "#56e6ff", presence * (.18 + intensity * .36), now, 37, true);
              drawLivingBolt(ctx, rightShoulder, rightOuter, "#ff5abc", presence * (.18 + intensity * .36), now, 71, true);
            }

            const wristEffect = (
              wrist: CanvasPoint | null,
              shoulder: CanvasPoint | null,
              velocity: PoseVisualVelocity,
              color: string,
              seed: number,
            ) => {
              if (!wrist || !readableVideo) return;
              const mappedVelocity = mapVelocity(readableVideo, width, height, velocity);
              const velocityLength = Math.hypot(mappedVelocity.x, mappedVelocity.y);
              const energy = Math.min(1, velocity.speed / .85);
              const fallbackX = shoulder ? wrist.x - shoulder.x : wrist.x < center.x ? -1 : 1;
              const fallbackY = shoulder ? wrist.y - shoulder.y : -.2;
              const fallbackLength = Math.max(1, Math.hypot(fallbackX, fallbackY));
              const directionX = velocityLength > 18 ? mappedVelocity.x / velocityLength : fallbackX / fallbackLength;
              const directionY = velocityLength > 18 ? mappedVelocity.y / velocityLength : fallbackY / fallbackLength;
              const boltLength = Math.min(width, height) * (.11 + energy * .22);
              const target = { x: wrist.x + directionX * boltLength, y: wrist.y + directionY * boltLength };
              drawLivingBolt(ctx, wrist, target, color, presence * (.18 + intensity * .25 + energy * .65), now, seed, true);
              ctx.save();
              ctx.globalCompositeOperation = "lighter";
              for (let i = 0; i < 11; i++) {
                const age = (i + 1) / 11;
                ctx.globalAlpha = presence * (.18 + energy * .42) * (1 - age);
                ctx.fillStyle = i % 2 ? color : "#ffffff";
                const spread = (pseudo(seed * 9 + i + Math.floor(now / 80)) - .5) * 18;
                ctx.fillRect(wrist.x - directionX * age * boltLength * .72 + spread, wrist.y - directionY * age * boltLength * .72 + spread * .35, 1.2 + energy * 2.2, 1.2 + energy * 2.2);
              }
              ctx.restore();
            };
            wristEffect(leftWrist, leftShoulder, pose.leftWristVelocity, "#5de9ff", 113);
            wristEffect(rightWrist, rightShoulder, pose.rightWristVelocity, "#ff57bc", 197);

            const eventEnergy = Math.max(movement, openness * .82, intensity * .64);
            if (eventEnergy > .52 && now >= nextShock) {
              shocks.push({ startedAt: now, x: center.x, y: center.y });
              nextShock = now + 800 + pseudo(now * .001) * 400;
            }
            for (let i = shocks.length - 1; i >= 0; i--) {
              const progress = (now - shocks[i].startedAt) / 1050;
              if (progress >= 1) { shocks.splice(i, 1); continue; }
              ctx.save();
              ctx.globalCompositeOperation = "lighter";
              ctx.globalAlpha = presence * eventEnergy * (1 - progress) * .46;
              ctx.strokeStyle = i % 2 ? "#ff5cc0" : "#63eaff";
              ctx.lineWidth = 1.5 + (1 - progress) * 2;
              ctx.shadowColor = ctx.strokeStyle;
              ctx.shadowBlur = 14;
              ctx.beginPath();
              ctx.ellipse(shocks[i].x, shocks[i].y, shoulderSpan * (.5 + progress * 2.8), shoulderSpan * (.22 + progress * 1.25), 0, 0, Math.PI * 2);
              ctx.stroke();
              ctx.restore();
            }
          }

          const halo = ctx.createRadialGradient(center.x, center.y, width * .04, center.x, center.y, width * (.38 + openness * .2));
          halo.addColorStop(0, `rgba(255,102,196,${.025 + openness * .045 + stillness * breath * .018})`);
          halo.addColorStop(.52, `rgba(58,218,255,${.035 + openness * .065})`);
          halo.addColorStop(1, "rgba(0,0,0,0)");
          ctx.globalCompositeOperation = "screen";
          ctx.globalAlpha = .9;
          ctx.fillStyle = halo;
          ctx.fillRect(0, 0, width, height);

          const particleEnergy = reduced ? .18 + intensity * .1 : .12 + intensity * .34 + movement * .62;
          const particlePresence = .16 + presence * .84;
          const scanY = height * (.5 + Math.sin(now * Math.PI / 1600) * .32);
          const visibleParticleCount = reduced ? 54 : Math.floor(38 + intensity * 82);
          for (let i = 0; i < visibleParticleCount; i++) {
            const particle = particles[i];
            const angle = particle.angle + now * .00022 * speed * (1 + movement * 3.2) + particle.phase;
            const radius = particle.radius * Math.min(width, height) * (.36 + openness * .18);
            const rise = (particle.phase / (Math.PI * 2) + now * .000035 * speed * (1 + movement * 4)) % 1;
            const x = center.x + Math.cos(angle) * radius * 1.08;
            const y = center.y + Math.sin(angle * .88) * radius * .52 + (.5 - rise) * height * .28;
            const scanBoost = Math.abs(y - scanY) < height * .018 ? 2.2 : 1;
            ctx.globalAlpha = Math.min(.82, particlePresence * particleEnergy * (.27 + (i % 5) * .04) * scanBoost);
            ctx.fillStyle = i % 2 ? "#ff66c7" : "#5de7ff";
            const size = particle.size * (1 + movement * 1.25) * (scanBoost > 1 ? 1.55 : 1);
            ctx.fillRect(x, y, size, size);
          }

          if (!reduced && presence > .25) {
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            for (let i = 0; i < 18; i++) {
              const x = center.x + (pseudo(i * 19 + Math.floor(now / 90)) - .5) * shoulderSpan * 3.1;
              const length = 2 + pseudo(i * 41) * (8 + movement * 20);
              ctx.globalAlpha = presence * (.04 + intensity * .08 + movement * .14);
              ctx.fillStyle = i % 2 ? "#ff5ebf" : "#5de8ff";
              ctx.fillRect(x, scanY + (pseudo(i * 7) - .5) * 12, length, 1);
            }
            ctx.restore();
          }

          const gestureAge = current.lastGesture ? (now - current.lastGesture.at) / 1000 : 99;
          if (!reduced && current.lastGesture && gestureAge >= 0 && gestureAge < .75) {
            const gestureAlpha = (1 - gestureAge / .75) * (.55 + current.lastGesture.strength * .4);
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            if (current.lastGesture.kind === "drop") {
              const fog = ctx.createLinearGradient(0, height * .52, 0, height);
              fog.addColorStop(0, "rgba(66,224,255,0)");
              fog.addColorStop(1, `rgba(74,225,255,${gestureAlpha * .32})`);
              ctx.fillStyle = fog; ctx.fillRect(0, height * .45, width, height * .55);
              ctx.globalAlpha = gestureAlpha;
              ctx.strokeStyle = "#7ceeff"; ctx.lineWidth = 2; ctx.shadowColor = "#59e6ff"; ctx.shadowBlur = 18;
              ctx.beginPath(); ctx.ellipse(center.x, height * (.78 + gestureAge * .12), width * (.16 + gestureAge * .5), height * (.025 + gestureAge * .06), 0, 0, Math.PI * 2); ctx.stroke();
            } else if (current.lastGesture.kind === "open") {
              ctx.globalAlpha = gestureAlpha;
              ctx.strokeStyle = "#ff68c6"; ctx.lineWidth = 3; ctx.shadowColor = "#ff54bd"; ctx.shadowBlur = 26;
              ctx.beginPath(); ctx.ellipse(center.x, center.y, shoulderSpan * (1 + gestureAge * 3.8), shoulderSpan * (.42 + gestureAge * 1.5), 0, 0, Math.PI * 2); ctx.stroke();
            } else if (current.lastGesture.kind === "sweepLeft" || current.lastGesture.kind === "sweepRight") {
              const wrist = current.lastGesture.kind === "sweepLeft" ? leftWrist : rightWrist;
              if (wrist) {
                const direction = current.lastGesture.kind === "sweepLeft" ? -1 : 1;
                ctx.globalAlpha = gestureAlpha;
                ctx.strokeStyle = current.lastGesture.kind === "sweepLeft" ? "#62ebff" : "#ff61c2";
                ctx.lineWidth = 4; ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 24;
                ctx.beginPath(); ctx.moveTo(wrist.x, wrist.y);
                ctx.bezierCurveTo(wrist.x + direction * width * .16, wrist.y - height * .12, wrist.x + direction * width * .3, wrist.y + height * .09, wrist.x + direction * width * .46, wrist.y - height * .04); ctx.stroke();
              }
            } else {
              ctx.globalAlpha = gestureAlpha * .24;
              ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, width, height);
            }
            if (current.lastGesture.onBeat) {
              ctx.globalAlpha = gestureAlpha * .22;
              ctx.fillStyle = "#dffcff"; ctx.fillRect(0, 0, width, height);
            }
            ctx.restore();
          }

          if (!reduced && beatPulse > 0) {
            ctx.save(); ctx.globalCompositeOperation = "screen"; ctx.globalAlpha = beatPulse * (.035 + current.beatState.lowEnergy * .08);
            ctx.fillStyle = current.comboState.count % 2 ? "#ff6ac4" : "#69eaff"; ctx.fillRect(0, 0, width, height); ctx.restore();
          }

          const haze = ctx.createLinearGradient(0, 0, width, height);
          haze.addColorStop(0, "rgba(78,218,255,.12)");
          haze.addColorStop(.5, "rgba(255,190,157,.035)");
          haze.addColorStop(1, "rgba(255,55,176,.14)");
          ctx.globalCompositeOperation = "screen";
          ctx.globalAlpha = 1;
          ctx.fillStyle = haze;
          ctx.fillRect(0, 0, width, height);

          ctx.globalCompositeOperation = "source-over";
          ctx.globalAlpha = .026;
          ctx.fillStyle = "#eefcff";
          for (let i = 0; i < 180; i++) {
            grainSeed = (grainSeed * 16807) % 2147483647;
            const x = grainSeed % width;
            grainSeed = (grainSeed * 16807) % 2147483647;
            const y = grainSeed % height;
            ctx.fillRect(x, y, 1.1, 1.1);
          }

          const historyCtx = historyContexts[historyIndex]!;
          historyCtx.setTransform(1, 0, 0, 1, 0, 0);
          historyCtx.globalAlpha = 1;
          historyCtx.filter = "none";
          historyCtx.drawImage(base, 0, 0);
          historyIndex = (historyIndex + 1) % history.length;
          historyCount = Math.min(history.length, historyCount + 1);
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
        ctx.filter = "none";
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [sourceRef, visuals]);

  return <canvas ref={canvasRef} className="rw-camera-canvas" aria-label="经过霓虹柔光处理的实时摄像头画面" />;
});

export default CameraPortrait;

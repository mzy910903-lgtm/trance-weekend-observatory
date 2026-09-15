"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PoseLandmarker, NormalizedLandmark } from "@mediapipe/tasks-vision";
import { clamp, initial, type Signals } from "./weather";

export type PoseVisualPoint = { x: number; y: number; visibility: number };
export type PoseVisualVelocity = { x: number; y: number; speed: number };
export type PoseVisuals = {
  nose: PoseVisualPoint | null;
  shoulderCenter: PoseVisualPoint | null;
  leftShoulder: PoseVisualPoint | null;
  rightShoulder: PoseVisualPoint | null;
  leftElbow: PoseVisualPoint | null;
  rightElbow: PoseVisualPoint | null;
  leftWrist: PoseVisualPoint | null;
  rightWrist: PoseVisualPoint | null;
  hipCenter: PoseVisualPoint | null;
  leftWristVelocity: PoseVisualVelocity;
  rightWristVelocity: PoseVisualVelocity;
  centerVelocity: PoseVisualVelocity;
  updatedAt: number;
};

const emptyVisuals = (): PoseVisuals => ({
  nose: null,
  shoulderCenter: null,
  leftShoulder: null,
  rightShoulder: null,
  leftElbow: null,
  rightElbow: null,
  leftWrist: null,
  rightWrist: null,
  hipCenter: null,
  leftWristVelocity: { x: 0, y: 0, speed: 0 },
  rightWristVelocity: { x: 0, y: 0, speed: 0 },
  centerVelocity: { x: 0, y: 0, speed: 0 },
  updatedAt: 0,
});

export function usePose() {
  const [status, setStatus] = useState<"off" | "permission" | "loading" | "ready" | "error">("off");
  const [error, setError] = useState("");
  const [present, setPresent] = useState(false);
  const signals = useRef<Signals>({ ...initial });
  const visuals = useRef<PoseVisuals>(emptyVisuals());
  const videoRef = useRef<HTMLVideoElement>(null);
  const resources = useRef<{ stream?: MediaStream; pose?: PoseLandmarker; video?: HTMLVideoElement; frame?: number }>({});
  const generation = useRef(0);
  const cleanup = useCallback(() => {
    generation.current++;
    const r = resources.current;
    if (r.frame) cancelAnimationFrame(r.frame);
    r.stream?.getTracks().forEach(t => t.stop()); r.pose?.close();
    if (r.video) { r.video.pause(); r.video.srcObject = null; }
    resources.current = {};
    visuals.current = emptyVisuals();
  }, []);
  const stop = useCallback(() => { cleanup(); setStatus("off"); setPresent(false); }, [cleanup]);
  useEffect(() => cleanup, [cleanup]);
  const start = async (): Promise<boolean> => {
    cleanup(); const token = generation.current;
    setStatus("permission"); setError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("摄像头需要 HTTPS 或 localhost，请使用安全地址打开。");
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: "user" }, audio: false });
      if (generation.current !== token) { stream.getTracks().forEach(t => t.stop()); return false; }
      resources.current.stream = stream;
      setStatus("loading");
      const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
      const files = await FilesetResolver.forVisionTasks("/rave-weather/wasm");
      const pose = await PoseLandmarker.createFromOptions(files, {
        baseOptions: {
          modelAssetPath: "/rave-weather/pose_landmarker_lite.task",
          // The CPU backend writes its successful XNNPACK initialization to
          // stderr. Next's development overlay presents that INFO line as an
          // application error, so use the browser's WebGL delegate explicitly.
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numPoses: 1,
        minPosePresenceConfidence: .6,
        minTrackingConfidence: .6,
      });
      if (generation.current !== token) { pose.close(); return false; }
      resources.current.pose = pose;
      const video = videoRef.current;
      if (!video) throw new Error("摄像头取景器尚未准备好，请重试。");
      video.srcObject = stream;
      resources.current.video = video; await video.play();
      if (generation.current !== token) return false;
      setStatus("ready");
      let previous: NormalizedLandmark[] | undefined, last = 0, seen = 0, baseline = 0;
      const detect = (now: number) => {
        if (generation.current !== token) return;
        if (now - last >= 65 && video.readyState >= 2) {
          const elapsed = now - last; last = now;
          try {
            const points = pose.detectForVideo(video, now).landmarks[0];
            if (points && [0, 11, 12].every(i => points[i].visibility > .45)) {
              seen = now; setPresent(true);
              const shoulderWidth = Math.max(.08, Math.abs(points[11].x - points[12].x));
              const shoulderY = (points[11].y + points[12].y) / 2;
              if (!baseline) baseline = shoulderY;
              const movement = previous ? clamp([11, 12, 15, 16, 23, 24].reduce((sum, i) => sum + Math.hypot(points[i].x - previous![i].x, points[i].y - previous![i].y), 0) / 6 / shoulderWidth * 25000 / elapsed) : 0;
              const openness = points[15].visibility > .5 && points[16].visibility > .5 ? clamp((Math.abs(points[15].x - points[16].x) / shoulderWidth - 1) * 40) : signals.current.openness;
              const target = { movement, openness, stillness: 100 - movement, pressure: clamp(70 - (shoulderY - baseline) * 300) };
              for (const key of Object.keys(target) as (keyof Signals)[]) signals.current[key] += (target[key] - signals.current[key]) * .28;
              const point = (index: number, minimum = .3): PoseVisualPoint | null => points[index].visibility > minimum
                ? { x: points[index].x, y: points[index].y, visibility: points[index].visibility }
                : null;
              const velocity = (index: number): PoseVisualVelocity => {
                if (!previous || points[index].visibility <= .3 || previous[index].visibility <= .3) return { x: 0, y: 0, speed: 0 };
                const x = (points[index].x - previous[index].x) * 1000 / Math.max(1, elapsed);
                const y = (points[index].y - previous[index].y) * 1000 / Math.max(1, elapsed);
                return { x, y, speed: Math.hypot(x, y) };
              };
              const leftShoulder = point(11, .4);
              const rightShoulder = point(12, .4);
              const leftHip = point(23, .25);
              const rightHip = point(24, .25);
              const centerVelocity = previous ? (() => {
                const x = ((points[11].x + points[12].x) - (previous[11].x + previous[12].x)) * 500 / Math.max(1, elapsed);
                const y = ((points[11].y + points[12].y) - (previous[11].y + previous[12].y)) * 500 / Math.max(1, elapsed);
                return { x, y, speed: Math.hypot(x, y) };
              })() : { x: 0, y: 0, speed: 0 };
              visuals.current = {
                nose: point(0, .4),
                shoulderCenter: leftShoulder && rightShoulder ? {
                  x: (leftShoulder.x + rightShoulder.x) / 2,
                  y: (leftShoulder.y + rightShoulder.y) / 2,
                  visibility: Math.min(leftShoulder.visibility, rightShoulder.visibility),
                } : null,
                leftShoulder,
                rightShoulder,
                leftElbow: point(13),
                rightElbow: point(14),
                leftWrist: point(15),
                rightWrist: point(16),
                hipCenter: leftHip && rightHip ? {
                  x: (leftHip.x + rightHip.x) / 2,
                  y: (leftHip.y + rightHip.y) / 2,
                  visibility: Math.min(leftHip.visibility, rightHip.visibility),
                } : null,
                leftWristVelocity: velocity(15),
                rightWristVelocity: velocity(16),
                centerVelocity,
                updatedAt: now,
              };
              previous = points;
            } else { previous = undefined; if (now - seen > 900) { setPresent(false); baseline = 0; visuals.current = emptyVisuals(); } }
          } catch { cleanup(); setStatus("error"); setPresent(false); setError("姿态处理已中断。请重新连接摄像头，或使用演示模式。"); return; }
        }
        resources.current.frame = requestAnimationFrame(detect);
      };
      resources.current.frame = requestAnimationFrame(detect);
      return true;
    } catch (e) {
      if (generation.current !== token) return false;
      cleanup(); setStatus("error"); setError(e instanceof Error && e.name === "NotAllowedError" ? "摄像头权限未开启。请在浏览器中允许访问，或使用演示模式。" : e instanceof Error ? e.message : "摄像头暂时不可用，请使用演示模式。");
      return false;
    }
  };
  return { status, error, present, signals, visuals, videoRef, start, stop };
}

"use client";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import Image from "next/image";
import Atmosphere from "./Atmosphere";
import CameraPortrait, { type CameraPortraitHandle } from "./CameraPortrait";
import DissolveTransition from "./DissolveTransition";
import HighlightLoop from "./HighlightLoop";
import WeatherClaim from "./WeatherClaim";
import { comboLevel, emptyCombo, normalizedHighlightPoints, reduceHighlight, selectHighlight, type ComboState, type GestureEvent, type GestureKind, type HighlightSample } from "./interaction";
import { clamp, createWeather, decodeWeather, encodeWeatherQrHash, initial, phases, weatherNameZh, weatherQuoteZh, weatherRemark, weatherVisualKind, type Phase, type Signals, type Weather } from "./weather";
import { useBeat } from "./useBeat";
import { usePose } from "./usePose";
import { trackRaveWeatherEvent } from "@/lib/rave-weather-events";

const CAPTURE_SECONDS = 23;
const TRANSITION_SECONDS = 7;
const TOTAL_SECONDS = 30;
const RESULT_REVEAL_SECONDS = 4;
const CLAIM_WINDOW_SECONDS = 35;
const CLAIMED_SECONDS = 6;
type ClaimStage = "reveal" | "preparing" | "waiting" | "claimed";
const attractMessages = [
  { title: "挥一下，会放电。", english: "MOVE FAST. MAKE LIGHTNING." },
  { title: "打开双臂，天空会让路。", english: "OPEN UP. MOVE THE WEATHER." },
  { title: "30 秒，带走一种天气。", english: "YOUR NIGHT. YOUR WEATHER." },
] as const;
const attractKinds = ["electricStorm", "onBeatAurora", "afterpartyRainbow"] as const;
type BeatTarget = { signal: keyof Signals; direction: "above" | "below"; threshold: number };
type ExperienceBeat = {
  id: "calibrate" | "release" | "move" | "open" | "surge";
  start: number;
  end: number;
  title: string;
  english: string;
  sub: string;
  effect: string;
  targets?: BeatTarget[];
  targetMode?: "any" | "all";
  success?: string;
  quip?: string;
};
const beats: ExperienceBeat[] = [
  { id: "calibrate", start: 0, end: 2, title: "天气正在认人。\n先别演。", english: "CALIBRATING YOUR ATMOSPHERE.", sub: "系统正在建立错误的第一印象。", effect: "正在对焦 / CALIBRATING" },
  { id: "release", start: 2, end: 7, title: "肩膀，\n放下来。", english: "LET YOUR SHOULDERS DROP.", sub: "保持一下，让气压真的降下来。", effect: "目标：气压低于 60", targets: [{ signal: "pressure", direction: "below", threshold: 60 }], success: "气压下降 ✓", quip: "嘴硬指数仍然很高。" },
  { id: "move", start: 7, end: 12, title: "跟着房间，\n动一下。", english: "MOVE WITH THE ROOM.", sub: "不用跳得好看，系统也没这个资格。", effect: "目标：捕获连续气流", targets: [{ signal: "movement", direction: "above", threshold: 38 }], success: "气流捕获 ✓", quip: "你说这只是晃两下。" },
  { id: "open", start: 12, end: 18, title: "把身体，\n打开。", english: "OPEN UP.", sub: "展开双臂，给天空一点空间。", effect: "目标：打开天空", targets: [{ signal: "openness", direction: "above", threshold: 60 }], success: "天空已打开 ✓", quip: "系统误以为你要压轴。" },
  { id: "surge", start: 18, end: 23, title: "最后五秒，\n别装了。来一下。", english: "ONE LAST MOVE. MAKE IT COUNT.", sub: "做今晚最大的动作。后果由天气承担。", effect: "检测克制中…", targets: [{ signal: "movement", direction: "above", threshold: 65 }, { signal: "openness", direction: "above", threshold: 75 }], targetMode: "any", success: "克制已下线 ✓", quip: "系统决定假装没看见。" },
];
const challengeBeats = beats.filter(beat => beat.targets);
const interactionStart = challengeBeats[0]?.start ?? 0;
const surgeBeat = beats.find(beat => beat.id === "surge") ?? beats[beats.length - 1];
const surgeDuration = surgeBeat.end - surgeBeat.start;
const transitionImpactStart = TRANSITION_SECONDS * .9;
const easterEggs = ["天气越权", "临时主舞台", "附近气候受到牵连"] as const;
const gestureLabels: Record<GestureKind, string> = { drop: "气压落地", sweepLeft: "左侧闪电", sweepRight: "右侧闪电", open: "天空撑开", surge: "能量超载" };
export default function Experience({ initialResult = null }: { initialResult?: Weather | null }) {
  const initialResultRef = useRef(initialResult);
  const [phase, setPhase] = useState<Phase>(initialResult?.phase ?? "DEEP");
  const [mode, setMode] = useState<"idle" | "camera" | "demo">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [signals, setSignals] = useState<Signals>(initialResult?.signals ?? initial);
  const [result, setResult] = useState<Weather | null>(initialResult);
  const [pendingResult, setPendingResult] = useState<Weather | null>(null);
  const [transitionElapsed, setTransitionElapsed] = useState(0);
  const [cameraSnapshot, setCameraSnapshot] = useState<ImageBitmap | null>(null);
  const [completedBeats, setCompletedBeats] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState<{ id: number; stamp: string; quip: string } | null>(null);
  const [combo, setCombo] = useState<ComboState>(emptyCombo);
  const [lastGesture, setLastGesture] = useState<GestureEvent | null>(null);
  const [goalProgress, setGoalProgress] = useState(0);
  const [shared, setShared] = useState(Boolean(initialResult));
  const [sound, setSound] = useState(false);
  const [settings, setSettings] = useState(false);
  const [qr, setQr] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [shareId, setShareId] = useState("");
  const [claimStage, setClaimStage] = useState<ClaimStage>("reveal");
  const [claimRemaining, setClaimRemaining] = useState(RESULT_REVEAL_SECONDS);
  const [notice, setNotice] = useState("");
  const [origin, setOrigin] = useState("");
  const [clock, setClock] = useState("");
  const [loading, setLoading] = useState(!initialResult);
  const [idleSeconds, setIdleSeconds] = useState(0);
  const [resourcesReady, setResourcesReady] = useState(false);
  const [localInstallation, setLocalInstallation] = useState(false);
  const {
    status: poseStatus,
    error: poseError,
    present: posePresent,
    signals: poseSignals,
    visuals: poseVisuals,
    videoRef,
    start: startPose,
    stop: stopPose,
  } = usePose();
  const { state: beatState, live: beatLive, start: startBeat, startVisualFallback, stop: stopBeat } = useBeat();
  const audio = useRef<AudioContext | null>(null);
  const cameraPortrait = useRef<CameraPortraitHandle>(null);
  const finalizing = useRef(false);
  const live = useRef({ signals, phase, mode, present: posePresent, poseStatus, result });
  const aggregate = useRef({ movement: 0, openness: 0, stillness: 0, pressure: 0, weight: 0 });
  const peaks = useRef({ movement: 0, openness: 0 });
  const completedRef = useRef<Set<string>>(new Set());
  const goalHold = useRef({ beatId: "", seconds: 0 });
  const feedbackId = useRef(0);
  const gestureId = useRef(0);
  const elapsedRef = useRef(0);
  const previousSignals = useRef<Signals>({ ...initial });
  const gestureCooldowns = useRef<Record<GestureKind, number>>({ drop: 0, sweepLeft: 0, sweepRight: 0, open: 0, surge: 0 });
  const comboRef = useRef<ComboState>({ ...emptyCombo });
  const onBeatCountRef = useRef(0);
  const comboLastAt = useRef(0);
  const highlightSamples = useRef<HighlightSample[]>([]);
  const lastHighlightAt = useRef(0);
  const sessionSeed = useRef(1);
  const pointer = useRef({ x: .5, y: .5, energy: 0 });
  const viewTracked = useRef(false);
  const shareLinkRequest = useRef<{ key: string; promise: Promise<{ id: string; url: string } | null> } | null>(null);
  const qrShownTracked = useRef(false);
  useEffect(() => { live.current = { signals, phase, mode, present: posePresent, poseStatus, result }; }, [signals, phase, mode, posePresent, poseStatus, result]);
  useEffect(() => {
    if (!viewTracked.current) {
      viewTracked.current = true;
      trackRaveWeatherEvent("view");
      if (location.hash || initialResultRef.current) trackRaveWeatherEvent("shared_view");
    }
    const timer = setTimeout(() => {
      setLocalInstallation(["localhost", "127.0.0.1"].includes(location.hostname));
      if (location.hash && !initialResultRef.current) { const w = decodeWeather(location.hash); if (w) { setResult(w); setSignals(w.signals); setPhase(w.phase); setShared(true); } else setNotice("这个天气链接无法读取。你可以重新生成一份。"); }
      const savedOrigin = localStorage.getItem("rave-weather-public-origin") || process.env.NEXT_PUBLIC_SITE_URL || "";
      if (savedOrigin) setOrigin(savedOrigin.replace(/\/$/, ""));
      setLoading(false);
    }, 0);
    const tick = setInterval(() => setClock(new Date().toLocaleTimeString("en-GB", { hour12: false })), 1000);
    return () => { clearTimeout(timer); clearInterval(tick); void audio.current?.close(); };
  }, []);
  useEffect(() => {
    if (loading || location.hash) return;
    let cancelled = false;
    const warm = async () => {
      try {
        await Promise.all([
          fetch("/rave-weather/pose_landmarker_lite.task", { cache: "force-cache" }),
          fetch("/rave-weather/wasm/vision_wasm_internal.js", { cache: "force-cache" }),
          fetch("/rave-weather/wasm/vision_wasm_internal.wasm", { cache: "force-cache" }),
        ]);
        if (!cancelled) setResourcesReady(true);
      } catch { if (!cancelled) setResourcesReady(false); }
    };
    const win = window as Window & { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    const idleId = win.requestIdleCallback ? win.requestIdleCallback(() => void warm(), { timeout: 2200 }) : window.setTimeout(() => void warm(), 900);
    return () => { cancelled = true; if (win.cancelIdleCallback) win.cancelIdleCallback(idleId); else clearTimeout(idleId); };
  }, [loading]);
  useEffect(() => {
    if (loading || mode !== "idle" || result || pendingResult) return;
    const timer = setInterval(() => setIdleSeconds(value => value + 1), 1000);
    return () => clearInterval(timer);
  }, [loading, mode, pendingResult, result]);
  useEffect(() => {
    if (mode === "idle" || result || pendingResult) return;
    const timer = setInterval(() => {
      const p = live.current;
      // The permission prompt pauses the clock. Model warm-up is part of the
      // recognition beat; tracking loss never extends the experience.
      if (p.mode === "camera" && !["loading", "ready"].includes(p.poseStatus)) return;
      let next = { ...poseSignals.current };
      if (p.mode === "demo") {
        pointer.current.energy *= .88;
        const movement = clamp(18 + pointer.current.energy * 80 + Math.sin(performance.now() / 900) * 8);
        next = { movement, openness: clamp(pointer.current.x * 100), stillness: 100 - movement, pressure: clamp(pointer.current.y * 100) };
      }
      setSignals(next);
      const sampleElapsed = elapsedRef.current;
      const now = performance.now();
      const sampleWeight = sampleElapsed >= surgeBeat.start ? 2 : 1;
      const a = aggregate.current; a.weight += sampleWeight;
      for (const k of ["movement", "openness", "stillness", "pressure"] as const) a[k] += next[k] * sampleWeight;
      peaks.current.movement = Math.max(peaks.current.movement, next.movement);
      peaks.current.openness = Math.max(peaks.current.openness, next.openness);
      const activeBeat = beats.find(item => sampleElapsed >= item.start && sampleElapsed < item.end);
      let gestureKind: GestureKind | null = null;
      let gestureStrength = 0;
      const visual = poseVisuals.current;
      const ready = (kind: GestureKind, cooldown: number) => now - gestureCooldowns.current[kind] >= cooldown;
      if (sampleElapsed >= interactionStart && (p.mode === "demo" || p.present)) {
        if (p.mode === "demo") {
          if (pointer.current.energy > .48 && ready("surge", 520)) { gestureKind = "surge"; gestureStrength = pointer.current.energy; }
          else if (next.openness > 64 && previousSignals.current.openness <= 58 && ready("open", 780)) { gestureKind = "open"; gestureStrength = next.openness / 100; }
          else if (activeBeat?.id === "release" && next.pressure < 60 && ready("drop", 1150)) { gestureKind = "drop"; gestureStrength = (100 - next.pressure) / 100; }
        } else {
          const leftSpeed = visual.leftWristVelocity.speed, rightSpeed = visual.rightWristVelocity.speed;
          if (Math.max(leftSpeed, rightSpeed) > .38) {
            const kind: GestureKind = leftSpeed >= rightSpeed ? "sweepLeft" : "sweepRight";
            if (ready(kind, 480)) { gestureKind = kind; gestureStrength = Math.min(1, Math.max(leftSpeed, rightSpeed) / .9); }
          }
          if (!gestureKind && next.openness > 64 && previousSignals.current.openness <= 58 && ready("open", 780)) { gestureKind = "open"; gestureStrength = next.openness / 100; }
          if (!gestureKind && activeBeat?.id === "release" && next.pressure < 60 && ready("drop", 1150)) { gestureKind = "drop"; gestureStrength = (100 - next.pressure) / 100; }
          if (!gestureKind && next.movement > 68 && previousSignals.current.movement <= 60 && ready("surge", 680)) { gestureKind = "surge"; gestureStrength = next.movement / 100; }
        }
      }
      if (gestureKind) {
        gestureCooldowns.current[gestureKind] = now;
        const beatSnapshot = beatLive.current;
        const onBeat = beatSnapshot.lastBeatAt > 0 && Math.abs(now - beatSnapshot.lastBeatAt) <= 180;
        if (onBeat) onBeatCountRef.current = Math.min(99, onBeatCountRef.current + 1);
        const count = now - comboLastAt.current <= 1400 ? comboRef.current.count + 1 : 1;
        const max = Math.max(comboRef.current.max, count);
        const energy = Math.min(100, comboRef.current.energy + gestureStrength * (onBeat ? 24 : 15));
        const easterEggZh = comboRef.current.easterEggZh || ((count >= 8 || (count >= 6 && energy > 75)) ? easterEggs[sessionSeed.current % easterEggs.length] : undefined);
        const nextCombo = { count, max, energy, level: comboLevel(count), ...(easterEggZh ? { easterEggZh } : {}) };
        const event = { id: ++gestureId.current, kind: gestureKind, strength: gestureStrength, at: now, onBeat };
        comboLastAt.current = now; comboRef.current = nextCombo; setCombo(nextCombo); setLastGesture(event);
        if ([2, 4, 8].includes(count)) {
          const label = count >= 8 ? "系统失控" : count >= 4 ? "天气越界" : "气流形成";
          setFeedback({ id: ++feedbackId.current, stamp: `${label} ×${count}`, quip: onBeat ? "正好踩中。系统开始偏心。" : `${gestureLabels[gestureKind]}，继续。` });
        } else if (onBeat) setFeedback({ id: ++feedbackId.current, stamp: `ON BEAT ×${count}`, quip: `${gestureLabels[gestureKind]}已被现场接住。` });
      } else if (now - comboLastAt.current > 1400 && (comboRef.current.count > 0 || comboRef.current.energy > 0)) {
        const energy = Math.max(0, comboRef.current.energy - 1.4);
        const nextCombo = { ...comboRef.current, count: 0, energy, level: comboLevel(0) };
        comboRef.current = nextCombo; setCombo(nextCombo);
      }
      previousSignals.current = next;

      if (activeBeat?.targets && !completedRef.current.has(activeBeat.id)) {
        const matches = activeBeat.targets.map(target => target.direction === "above" ? next[target.signal] > target.threshold : next[target.signal] < target.threshold);
        const eligible = p.mode === "demo" || p.present;
        const met = eligible && (activeBeat.targetMode === "all" ? matches.every(Boolean) : matches.some(Boolean));
        if (goalHold.current.beatId !== activeBeat.id) goalHold.current = { beatId: activeBeat.id, seconds: 0 };
        goalHold.current.seconds = met ? goalHold.current.seconds + .1 : 0;
        setGoalProgress(Math.min(1, goalHold.current.seconds / .7));
        if (goalHold.current.seconds >= .7) {
          completedRef.current.add(activeBeat.id);
          setCompletedBeats(Object.fromEntries([...completedRef.current].map(id => [id, true])));
          setFeedback({ id: ++feedbackId.current, stamp: activeBeat.success || "动作捕获 ✓", quip: activeBeat.quip || "天气已经记住了。" });
          setGoalProgress(1);
        }
      } else if (activeBeat && completedRef.current.has(activeBeat.id)) setGoalProgress(1);
      else setGoalProgress(0);

      const highlightSlot = Math.floor(sampleElapsed * 8);
      if (sampleElapsed >= interactionStart && highlightSlot !== lastHighlightAt.current) {
        lastHighlightAt.current = highlightSlot;
        const points = p.mode === "demo" ? (() => {
          const sway = (pointer.current.x - .5) * .7, spread = .7 + next.openness / 80;
          return [
            { x: sway, y: -.72, visibility: 1 }, { x: sway - .5, y: 0, visibility: 1 }, { x: sway + .5, y: 0, visibility: 1 },
            { x: sway - spread * .72, y: .45, visibility: 1 }, { x: sway + spread * .72, y: .45, visibility: 1 },
            { x: sway - spread, y: .1 + (pointer.current.y - .5) * .4, visibility: 1 }, { x: sway + spread, y: .1 - (pointer.current.y - .5) * .4, visibility: 1 },
            { x: sway, y: 1.35, visibility: 1 },
          ];
        })() : normalizedHighlightPoints(visual);
        const recentOnBeat = now - beatLive.current.lastBeatAt <= 180;
        highlightSamples.current.push({ at: sampleElapsed, points, score: next.movement * .5 + next.openness * .25 + comboRef.current.energy * .2 + (recentOnBeat ? 15 : 0) });
      }
      elapsedRef.current = Math.min(CAPTURE_SECONDS, sampleElapsed + .1);
      setElapsed(elapsedRef.current);
    }, 100);
    return () => clearInterval(timer);
  }, [mode, result, pendingResult, poseSignals, poseVisuals, beatLive]);
  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 1700);
    return () => clearTimeout(timer);
  }, [feedback]);
  useEffect(() => {
    if (elapsed < CAPTURE_SECONDS || result || pendingResult || finalizing.current) return;
    finalizing.current = true;
    let cancelled = false;
    void (async () => {
      const snapshot = live.current.mode === "camera" ? await cameraPortrait.current?.captureFrame() ?? null : null;
      if (cancelled) { snapshot?.close(); finalizing.current = false; return; }
      const a = aggregate.current;
      const averaged = a.weight > 0
        ? Object.fromEntries((["movement", "openness", "stillness", "pressure"] as const).map(k => [k, Math.round(a[k] / a.weight)])) as Signals
        : { ...live.current.signals };
      averaged.movement = Math.min(100, Math.max(averaged.movement, Math.round(peaks.current.movement * .85)));
      averaged.openness = Math.min(100, Math.max(averaged.openness, Math.round(peaks.current.openness * .85)));
      const highlight = selectHighlight(highlightSamples.current);
      let weather = createWeather(averaged, live.current.phase, live.current.mode === "demo", {
        seed: sessionSeed.current,
        maxCombo: comboRef.current.max,
        onBeatCount: onBeatCountRef.current,
        easterEggZh: comboRef.current.easterEggZh,
        highlight,
        highlightCaptionZh: comboRef.current.max >= 8 ? "刚才这四秒，系统失去了控制。" : "系统找到了你最不像在克制的四秒。",
      });
      if (encodeURIComponent(JSON.stringify(weather)).length > 2400 && weather.highlight) weather = { ...weather, highlight: reduceHighlight(weather.highlight) };
      setCameraSnapshot(snapshot);
      setTransitionElapsed(0);
      setPendingResult(weather);
      stopPose();
      stopBeat();
      finalizing.current = false;
    })();
    return () => { cancelled = true; };
  }, [elapsed, result, pendingResult, stopPose, stopBeat]);
  useEffect(() => {
    if (!pendingResult) return;
    const startedAt = performance.now();
    let frame = 0;
    let lastUpdate = 0;
    const tick = (now: number) => {
      const next = Math.min(TRANSITION_SECONDS, (now - startedAt) / 1000);
      if (now - lastUpdate > 32 || next >= TRANSITION_SECONDS) {
        setTransitionElapsed(next);
        lastUpdate = now;
      }
      if (next >= TRANSITION_SECONDS) {
        trackRaveWeatherEvent("complete", weatherVisualKind(pendingResult));
        setClaimStage("reveal");
        setClaimRemaining(RESULT_REVEAL_SECONDS);
        qrShownTracked.current = false;
        setResult(pendingResult);
        setPendingResult(null);
        setCameraSnapshot(current => { current?.close(); return null; });
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [pendingResult]);
  useEffect(() => {
    if (!result) return;
    let cancelled = false;
    const base = origin || location.origin;
    const buildQr = async (value: string) => QRCode.toDataURL(value, { width: 360, margin: 4, errorCorrectionLevel: "M", color: { dark: "#111519", light: "#e8ecea" } });
    void (async () => {
      try {
        if (shared) {
          if (!cancelled) setShareUrl(location.href);
          return;
        }
        const compactUrl = new URL("/rave-weather", base);
        if (!["http:", "https:"].includes(compactUrl.protocol)) throw new Error();
        compactUrl.hash = encodeWeatherQrHash(result);
        const requestKey = `${base}|${result.seed}|${result.date}`;
        if (shareLinkRequest.current?.key !== requestKey) {
          const endpoint = new URL("/api/rave-weather/shares", base);
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5_000);
          const promise = fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ weather: result }),
            signal: controller.signal,
          }).then(async response => {
            if (!response.ok) return null;
            const data = await response.json() as { id?: unknown; url?: unknown };
            if (typeof data.id !== "string" || !/^[A-Za-z0-9_-]{12}$/.test(data.id) || typeof data.url !== "string") return null;
            const link = new URL(data.url);
            const secureOrLocal = link.protocol === "https:" || (link.protocol === "http:" && ["localhost", "127.0.0.1"].includes(link.hostname));
            return secureOrLocal ? { id: data.id, url: link.toString() } : null;
          }).catch(() => null).finally(() => clearTimeout(timeout));
          shareLinkRequest.current = { key: requestKey, promise };
        }
        const shortLink = await shareLinkRequest.current.promise;
        if (cancelled) return;
        if (shortLink) {
          setShareId(shortLink.id);
          setShareUrl(shortLink.url);
          setQr(await buildQr(shortLink.url));
        } else {
          setShareId("");
          setShareUrl(compactUrl.toString());
          setQr(await buildQr(compactUrl.toString()));
        }
      } catch {
        if (!cancelled) {
          setQr("");
          setShareUrl("");
          setNotice("领取码暂时无法生成，系统即将进入下一位。");
          setClaimStage("waiting");
          setClaimRemaining(10);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [result, origin, shared]);
  const foundBeatIndex = beats.findIndex(beat => elapsed >= beat.start && elapsed < beat.end);
  const beatIndex = foundBeatIndex < 0 ? beats.length - 1 : foundBeatIndex;
  const beat = beats[beatIndex] || beats[beats.length - 1];
  const sessionProgress = Math.min(1, elapsed / CAPTURE_SECONDS);
  const completionRatio = Object.keys(completedBeats).length / challengeBeats.length;
  const sessionIntensity = Math.min(1, .15 + sessionProgress * .68 + completionRatio * .12 + (beat.id === "surge" ? .12 : 0));
  const finalPush = mode !== "idle" && !result && !pendingResult && elapsed >= surgeBeat.start;
  const impactStarted = transitionElapsed >= transitionImpactStart;
  useEffect(() => {
    if (!sound || !audio.current || mode === "idle" || pendingResult || result) return;
    const ctx = audio.current, osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = "sine"; osc.frequency.setValueAtTime(result ? 90 : 55 + (beatIndex + 1) * 15, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(35, ctx.currentTime + 1.8);
    gain.gain.setValueAtTime(0, ctx.currentTime); gain.gain.linearRampToValueAtTime(.08, ctx.currentTime + .1); gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + 2);
    osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 2);
    return () => { osc.disconnect(); gain.disconnect(); };
  }, [beatIndex, result, sound, mode, pendingResult]);
  useEffect(() => {
    if (!sound || !audio.current || !feedback) return;
    const ctx = audio.current, osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(310, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(620, ctx.currentTime + .18);
    gain.gain.setValueAtTime(.045, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .32);
    osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + .34);
    return () => { osc.disconnect(); gain.disconnect(); };
  }, [feedback, sound]);
  useEffect(() => {
    if (!sound || !audio.current || !finalPush) return;
    const ctx = audio.current, osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(32, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(92, ctx.currentTime + surgeDuration);
    gain.gain.setValueAtTime(.004, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(.065, ctx.currentTime + Math.max(.1, surgeDuration - .2));
    osc.connect(gain); gain.connect(ctx.destination); osc.start();
    return () => { try { osc.stop(); } catch {} osc.disconnect(); gain.disconnect(); };
  }, [finalPush, sound]);
  useEffect(() => {
    if (!sound || !audio.current || !pendingResult) return;
    const ctx = audio.current;
    const click = ctx.createOscillator();
    const clickGain = ctx.createGain();
    click.type = "square"; click.frequency.value = 180;
    clickGain.gain.setValueAtTime(.055, ctx.currentTime);
    clickGain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .1);
    click.connect(clickGain); clickGain.connect(ctx.destination); click.start(); click.stop(ctx.currentTime + .11);
    const airBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const airData = airBuffer.getChannelData(0);
    for (let i = 0; i < airData.length; i++) airData[i] = Math.random() * 2 - 1;
    const air = ctx.createBufferSource();
    const airFilter = ctx.createBiquadFilter();
    const airGain = ctx.createGain();
    air.buffer = airBuffer; air.loop = true; airFilter.type = "bandpass"; airFilter.frequency.value = 720; airFilter.Q.value = .8;
    airGain.gain.setValueAtTime(.006, ctx.currentTime); airGain.gain.linearRampToValueAtTime(.038, ctx.currentTime + Math.max(.1, transitionImpactStart - .3));
    air.connect(airFilter); airFilter.connect(airGain); airGain.connect(ctx.destination); air.start();
    const rise = ctx.createOscillator();
    const riseGain = ctx.createGain();
    rise.type = "sine"; rise.frequency.setValueAtTime(31, ctx.currentTime); rise.frequency.exponentialRampToValueAtTime(76, ctx.currentTime + transitionImpactStart);
    riseGain.gain.setValueAtTime(.004, ctx.currentTime); riseGain.gain.linearRampToValueAtTime(.055, ctx.currentTime + Math.max(.1, transitionImpactStart - .1));
    rise.connect(riseGain); riseGain.connect(ctx.destination); rise.start();
    return () => { click.disconnect(); clickGain.disconnect(); air.stop(); air.disconnect(); airFilter.disconnect(); airGain.disconnect(); rise.stop(); rise.disconnect(); riseGain.disconnect(); };
  }, [pendingResult, sound]);
  useEffect(() => {
    if (!sound || !audio.current || !pendingResult || !impactStarted) return;
    const ctx = audio.current;
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = "sine";
    sub.frequency.setValueAtTime(82, ctx.currentTime);
    sub.frequency.exponentialRampToValueAtTime(34, ctx.currentTime + 1.4);
    subGain.gain.setValueAtTime(.001, ctx.currentTime);
    subGain.gain.exponentialRampToValueAtTime(.18, ctx.currentTime + .03);
    subGain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + 1.5);
    sub.connect(subGain); subGain.connect(ctx.destination); sub.start(); sub.stop(ctx.currentTime + 1.6);
    const noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * .7), ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) noiseData[i] = (Math.random() * 2 - 1) * (1 - i / noiseData.length);
    const noise = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const noiseGain = ctx.createGain();
    noise.buffer = noiseBuffer; filter.type = "bandpass"; filter.frequency.value = 1100; filter.Q.value = .7; noiseGain.gain.value = .045;
    noise.connect(filter); filter.connect(noiseGain); noiseGain.connect(ctx.destination); noise.start();
    return () => { sub.disconnect(); subGain.disconnect(); noise.disconnect(); filter.disconnect(); noiseGain.disconnect(); };
  }, [impactStarted, pendingResult, sound]);
  const toggleSound = async () => {
    try { if (!audio.current) audio.current = new AudioContext(); await audio.current.resume(); setSound(!sound); } catch { setNotice("此浏览器暂时无法播放声音。"); }
  };
  const reset = () => {
    stopPose(); stopBeat(); cameraSnapshot?.close(); setCameraSnapshot(null); setResult(null); setPendingResult(null); setTransitionElapsed(0);
    setShared(false); setElapsed(0); setSignals(initial); setMode("idle"); setQr(""); setShareUrl(""); setShareId(""); setNotice(""); setSettings(false); setCompletedBeats({}); setFeedback(null); setCombo({ ...emptyCombo }); setLastGesture(null); setGoalProgress(0); setIdleSeconds(0); setClaimStage("reveal"); setClaimRemaining(RESULT_REVEAL_SECONDS);
    elapsedRef.current = 0; finalizing.current = false; completedRef.current.clear(); goalHold.current = { beatId: "", seconds: 0 };
    peaks.current = { movement: 0, openness: 0 }; aggregate.current = { movement: 0, openness: 0, stillness: 0, pressure: 0, weight: 0 };
    previousSignals.current = { ...initial }; gestureCooldowns.current = { drop: 0, sweepLeft: 0, sweepRight: 0, open: 0, surge: 0 };
    comboRef.current = { ...emptyCombo }; onBeatCountRef.current = 0; comboLastAt.current = 0; highlightSamples.current = []; lastHighlightAt.current = 0;
    shareLinkRequest.current = null;
    qrShownTracked.current = false;
    sessionSeed.current = crypto.getRandomValues(new Uint32Array(1))[0];
    history.replaceState(null, "", "/rave-weather");
  };
  useEffect(() => {
    if (!result || shared || settings || claimStage === "preparing") return;
    const timer = setInterval(() => setClaimRemaining(value => {
      if (value > 1) return value - 1;
      queueMicrotask(() => {
        if (claimStage === "reveal") {
          if (qr) {
            setClaimStage("waiting");
            setClaimRemaining(CLAIM_WINDOW_SECONDS);
            if (!qrShownTracked.current) {
              qrShownTracked.current = true;
              trackRaveWeatherEvent("qr_shown", weatherVisualKind(result));
            }
          } else {
            setClaimStage("preparing");
            setClaimRemaining(0);
          }
        } else {
          reset();
        }
      });
      return 0;
    }), 1000);
    return () => clearInterval(timer);
  // Settings pause the unattended installation timer.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claimStage, qr, result, settings, shared]);
  useEffect(() => {
    if (!result || shared || claimStage !== "preparing" || !qr) return;
    queueMicrotask(() => {
      setClaimStage("waiting");
      setClaimRemaining(CLAIM_WINDOW_SECONDS);
      if (!qrShownTracked.current) {
        qrShownTracked.current = true;
        trackRaveWeatherEvent("qr_shown", weatherVisualKind(result));
      }
    });
  }, [claimStage, qr, result, shared]);
  useEffect(() => {
    if (!result || shared || claimStage !== "waiting" || !shareId) return;
    let active = true;
    const check = async () => {
      try {
        const response = await fetch(`/api/rave-weather/shares/${encodeURIComponent(shareId)}/status`, { cache: "no-store" });
        if (!response.ok || !active) return;
        const data = await response.json() as { state?: unknown };
        if (data.state === "claimed") {
          setClaimStage("claimed");
          setClaimRemaining(CLAIMED_SECONDS);
        }
      } catch {}
    };
    void check();
    const timer = setInterval(() => void check(), 1_500);
    return () => { active = false; clearInterval(timer); };
  }, [claimStage, result, shareId, shared]);
  const startDemo = () => { reset(); setMode("demo"); trackRaveWeatherEvent("start_demo"); startVisualFallback(); };
  const startCamera = async () => {
    reset(); setMode("camera");
    if (await startPose()) { trackRaveWeatherEvent("start_camera"); void startBeat(); }
  };
  const finishNow = () => { elapsedRef.current = CAPTURE_SECONDS; setElapsed(CAPTURE_SECONDS); };
  const active = mode !== "idle" && !result && !pendingResult;
  const current = signals.movement > 65 ? "WIND" : signals.movement > 30 ? "DRIFT" : "FOG";
  const currentZh = current === "WIND" ? "风" : current === "DRIFT" ? "漂移" : "雾";
  const remaining = pendingResult ? Math.max(0, Math.ceil(TRANSITION_SECONDS - transitionElapsed)) : Math.max(TRANSITION_SECONDS, Math.ceil(TOTAL_SECONDS - elapsed));
  const cameraStatus = poseStatus === "permission" ? "等待摄像头权限" : poseStatus === "loading" ? "正在启动天气系统" : posePresent ? "身体已进入天气系统" : elapsed > 0 ? "暂时离开画面 · 体验继续" : "请站进取景框";
  const beatLabel = beatState.status === "off" ? "节拍待机" : beatState.status === "permission" ? "等待麦克风" : beatState.source === "microphone" ? beatState.confidence >= .45 ? `节拍锁定 ${beatState.bpm} BPM` : "正在听现场节拍" : "内部节拍运行中";
  const comboLabel = combo.level === "storm" ? "系统失控" : combo.level === "override" ? "天气越界" : combo.level === "airflow" ? "气流形成" : "等待连招";
  const displayedWeather = result ?? pendingResult;
  const attractActive = mode === "idle" && !result && !pendingResult && idleSeconds >= 8;
  const attractIndex = Math.floor(Math.max(0, idleSeconds - 8) / 3) % attractMessages.length;
  const attractMessage = attractMessages[attractIndex];
  const publicOriginReady = (() => { try { const url = new URL(origin); return url.protocol === "https:" && !["localhost", "127.0.0.1"].includes(url.hostname); } catch { return false; } })();
  if (shared && result) return <WeatherClaim weather={result} shareUrl={shareUrl || "/rave-weather"} />;
  return <main className={`rw ${mode === "camera" && active ? "rw-with-camera" : ""} ${attractActive ? "rw-attract" : ""}`} onPointerMove={e => { const rect = e.currentTarget.getBoundingClientRect(); const x = (e.clientX - rect.left) / rect.width, y = (e.clientY - rect.top) / rect.height; pointer.current.energy = Math.min(1, pointer.current.energy + Math.hypot(x - pointer.current.x, y - pointer.current.y) * 8); pointer.current.x = x; pointer.current.y = y; }}>
    <Atmosphere signals={displayedWeather?.signals ?? signals} phase={phase} seed={displayedWeather?.seed ?? 314159} visualKind={displayedWeather ? weatherVisualKind(displayedWeather) : attractActive ? attractKinds[attractIndex] : undefined} transitionProgress={pendingResult ? transitionElapsed / TRANSITION_SECONDS : 0} sessionProgress={active ? sessionProgress : attractActive ? .6 : 0} beatState={beatState} comboState={combo} lastGesture={lastGesture} />
    {result?.highlight && claimStage === "reveal" && <HighlightLoop highlight={result.highlight} weather={result} />}
    <div className="rw-vignette" />
    {pendingResult && <DissolveTransition elapsed={transitionElapsed} duration={TRANSITION_SECONDS} snapshot={cameraSnapshot} weather={pendingResult} />}
    <header className="rw-header"><a href="/rave-weather" className="rw-brand">RAVE<br />WEATHER<span>®</span></a><div className="rw-edition">TRANCEWEEKEND<span>内在天气体验</span></div><button className="rw-icon" onClick={toggleSound} aria-label={sound ? "关闭声音" : "开启声音"}>{sound ? "◖))" : "◖×"}<span>声音 {sound ? "开" : "关"}</span></button></header>
    <div className="rw-topline"><span><i className={active || claimStage === "waiting" ? "rw-dot live" : "rw-dot"} />{result ? claimStage === "claimed" ? "天气已被手机接住" : claimStage === "waiting" ? "等待手机领取" : claimStage === "preparing" ? "正在生成领取码" : "天气已经生成" : pendingResult ? "正在形成天气" : mode === "camera" ? `${cameraStatus} · ${beatLabel}` : mode === "demo" ? `试玩模式 · ${beatLabel}` : "天气系统正在呼吸"}</span><span>北京 <b>{clock || "--:--:--"}</b></span></div>
    <div className="rw-coordinate">39°54′ N<br />116°24′ E</div><div className="rw-side">NO TWO NIGHTS. NO TWO WEATHERS.</div>
    <aside className={`rw-camera ${mode === "camera" && active ? "visible" : ""} ${posePresent ? "detected" : ""}`} aria-label="Live camera preview">
      <div className="rw-camera-frame">
        <video ref={videoRef} className="rw-camera-source" autoPlay muted playsInline />
        <CameraPortrait ref={cameraPortrait} sourceRef={videoRef} signals={signals} visuals={poseVisuals} present={posePresent} phase={phase} sessionIntensity={sessionIntensity} beatState={beatState} comboState={combo} lastGesture={lastGesture} />
        <i className="rw-camera-corners" />
        <span className="rw-camera-scan" />
      </div>
      <div className="rw-camera-caption">
        <span><i />{poseStatus === "permission" ? "请允许使用摄像头" : poseStatus === "loading" ? "天气系统启动中" : posePresent ? "已识别身体" : "请把头和双肩放进框内"}</span>
        <b>摄像头与音乐仅本机分析 · 不会录制</b>
      </div>
    </aside>
    <section className={`rw-center ${result ? "rw-result" : ""}`} aria-live="polite">
      {loading ? <p className="rw-eyebrow">正在进入天气系统</p> : result ? claimStage === "reveal" ? <>
        <p className="rw-eyebrow">今晚现场鉴定{result.demo && " / 试玩结果"}{result.highlight && " · 专属天气重演中"}</p>
        <h1 className="rw-result-name">{weatherNameZh(result)}</h1>
        <p className="rw-result-english">{result.name}</p>
        <p className="rw-quote rw-verdict">{weatherQuoteZh(result)}</p><p className="rw-official-note">{weatherRemark(result)}</p>
        {result.highlightCaptionZh && <p className="rw-highlight-caption">{result.highlightCaptionZh}</p>}
        {result.easterEggZh && <p className="rw-result-egg">系统事件：{result.easterEggZh}</p>}
        <p className="rw-fiction-note">仅供嘴硬参考 · 不构成正经天气预报</p>
        <div className="rw-metrics">{[["动作", result.signals.movement], ["静止", result.signals.stillness], ["展开", result.signals.openness], ["连招", `×${result.maxCombo || 1}`], ...(result.onBeatCount ? [["踩点", `×${result.onBeatCount}`]] : [])].map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}</div>
        <p className="rw-result-handoff">领取二维码将在 <b>{claimRemaining}</b> 秒后出现</p>
      </> : <div className={`rw-claim-screen ${claimStage}`}>
        {claimStage === "claimed" ? <>
          <div className="rw-claim-check">✓</div>
          <p className="rw-eyebrow">WEATHER RECEIVED</p>
          <h1>天气已被<br />手机接住</h1>
          <p className="rw-claim-weather">{weatherNameZh(result)} / {result.name}</p>
          <p className="rw-claim-countdown"><b>{claimRemaining}</b> 秒后迎接下一位</p>
        </> : <>
          <p className="rw-eyebrow">{claimStage === "preparing" ? "正在生成领取码" : "YOUR WEATHER IS READY"}</p>
          <h1>扫码，把这场<br />天气带走</h1>
          <p className="rw-claim-weather">{weatherNameZh(result)} / {result.name}</p>
          {qr ? <div className="rw-claim-qr"><Image unoptimized width={360} height={360} src={qr} alt="扫码在手机保存自己的天气" priority /></div> : <div className="rw-claim-qr-loading"><i /><span>正在连接天气领取处…</span></div>}
          {claimStage === "waiting" && <p className="rw-claim-countdown">手机打开后可以保存 4 秒纯天气 · <b>{claimRemaining}</b> 秒</p>}
          {!shareId && qr && <p className="rw-claim-fallback-note">当前使用离线领取码，投屏会按倒计时自动进入下一位。</p>}
          {!origin && localInstallation && <p className="rw-claim-fallback-note">请在装置设置中填写已部署的 HTTPS 地址。</p>}
        </>}
      </div> : pendingResult ? null : active ? <>
        <div className="rw-beat-flash" key={`flash-${beat.id}`} />
        <p className="rw-eyebrow">天气形成度 {String(Math.round(sessionProgress * 100)).padStart(2, "0")}% · {currentZh} / {current}</p>
        <h1 className="rw-instruction rw-beat-enter" key={beat.id}>{beat.title.split("\n").map(t => <span key={t}>{t}</span>)}</h1>
        <p className="rw-instruction-en rw-beat-enter" key={`${beat.id}-en`}>{beat.english}</p>
        <p className="rw-subtitle">{mode === "camera" && !posePresent ? "把头和双肩放进左侧取景框，倒计时仍会继续。" : completedBeats[beat.id] && beat.quip ? beat.quip : beat.sub}</p>
        <p className={`rw-effect ${completedBeats[beat.id] ? "complete" : ""}`}>{completedBeats[beat.id] ? beat.success : beat.effect}</p>
        <div className={`rw-combo rw-combo-${combo.level}`}><div><span>天气连招</span><b>×{combo.count}</b><em>{comboLabel}{lastGesture ? ` · ${gestureLabels[lastGesture.kind]}` : ""}</em></div><i><b style={{ width: `${combo.energy}%` }} /></i></div>
        {!completedBeats[beat.id] && beat.targets && <div className="rw-goal-charge"><i style={{ width: `${goalProgress * 100}%` }} /></div>}
        {combo.easterEggZh && <div className="rw-easter-egg">⚠ 系统事件<br /><b>{combo.easterEggZh}</b></div>}
        {feedback && <div className="rw-goal-stamp" key={feedback.id}><b>{feedback.stamp}</b><span>{feedback.quip}</span></div>}
        {finalPush && <strong className="rw-final-countdown" key={Math.ceil(CAPTURE_SECONDS - elapsed)}>{Math.max(1, Math.ceil(CAPTURE_SECONDS - elapsed))}</strong>}
        <p className="rw-auto-end">距离结果还有 <b>00:{String(remaining).padStart(2, "0")}</b><span>第 {TOTAL_SECONDS} 秒自动生成</span></p>
        <div className="rw-session-actions"><button className="rw-primary rw-finish" onClick={finishNow}>立即生成结果 <span>↗</span></button><button className="rw-text-button" onClick={reset}>取消体验 ×</button></div>
      </> : <>
        <p className="rw-eyebrow">{attractActive ? "天气系统正在寻找下一位" : "一张没有照片的身体肖像"}</p>
        <h1 className="rw-home-title" key={attractActive ? attractIndex : "home"}>{attractActive ? attractMessage.title : "今晚，你是什么天气？"}</h1>
        <p className="rw-subtitle">{attractActive ? attractMessage.english : "WHAT DID THE NIGHT DO TO YOU?"}</p>
        <div className="rw-entry"><button className="rw-primary" onClick={startCamera}>进入天气系统 <span>↗</span></button><button className="rw-text-button" onClick={startDemo}>不用摄像头，先试玩 <span>→</span></button></div>
        <p className="rw-duration">{TOTAL_SECONDS} 秒。四次挑战。只在今晚。</p>
      </>}
    </section>
    {active && <aside className={`rw-session ${beat.id === "surge" ? "surge" : ""}`}><div className="rw-session-heading"><span>{mode === "demo" ? "移动指针 / 左右展开，上下落肩" : "天气形成度"}</span><b>{String(Math.round(sessionProgress * 100)).padStart(2, "0")}%</b></div><div className="rw-progress"><i style={{ width: `${sessionProgress * 100}%` }} /></div><div className="rw-steps">{challengeBeats.map((item, i) => <span className={`${completedBeats[item.id] ? "completed" : ""} ${beat.id === item.id ? "selected" : ""}`} key={item.id}>{String(i + 1).padStart(2, "0")} {item.id === "release" ? "放松" : item.id === "move" ? "移动" : item.id === "open" ? "打开" : "爆发"}</span>)}</div></aside>}
    {(poseError || notice) && <div className="rw-notice" role="status">{poseError || notice}{poseStatus === "error" && <button onClick={startDemo}>进入演示 →</button>}<button aria-label="Dismiss message" onClick={() => { setNotice(""); if (poseError) reset(); }}>×</button></div>}
    <footer className="rw-footer"><div className="rw-phase"><span>房间正处于</span><button onClick={() => setSettings(!settings)} aria-expanded={settings}>{phase} <span>⌄</span></button></div><p>你的动作正在变成天气。<br /><span>实时处理，不保存摄像头或音频。</span></p><button className="rw-settings" aria-label="打开装置设置" onClick={() => setSettings(!settings)}>⊞ <span>装置 001</span></button></footer>
    {settings && <div className="rw-panel"><div className="rw-panel-title">现场设置<button aria-label="关闭设置" onClick={() => setSettings(false)}>×</button></div><div className="rw-self-check"><span className={resourcesReady ? "ok" : "wait"}>视觉模型 {resourcesReady ? "已预热" : "预热中"}</span><span className={poseStatus === "ready" ? "ok" : "wait"}>摄像头 {poseStatus === "ready" ? "可用" : "待授权"}</span><span className={beatState.status === "listening" ? "ok" : "wait"}>现场节拍 {beatState.status === "listening" ? "已接入" : "可降级"}</span><span className={publicOriginReady ? "ok" : "wait"}>分享地址 {publicOriginReady ? "有效" : "待配置"}</span></div><label>音乐阶段 / SET PHASE</label><div className="rw-phase-options">{phases.map(p => <button disabled={active || !!result || !!pendingResult} className={phase === p ? "chosen" : ""} key={p} onClick={() => setPhase(p)}>{p}</button>)}</div><label htmlFor="public-origin">扫码公开地址 / PUBLIC HTTPS ORIGIN</label><input id="public-origin" type="url" value={origin} placeholder="https://observatory.tranceweekend.com" onChange={e => { const value = e.target.value; setOrigin(value); localStorage.setItem("rave-weather-public-origin", value); }} /><p>摄像头和现场音乐只在浏览器内实时分析。分享链接只包含天气参数与量化动作节奏，不上传原始视频或音频，也不代表情绪或心理指标。</p><button className="rw-text-button" onClick={() => { if (!document.fullscreenElement) void document.documentElement.requestFullscreen().catch(() => setNotice("当前浏览器不支持全屏。")); else void document.exitFullscreen(); }}>切换全屏 ↗</button>{result && <button className="rw-text-button rw-next-emergency" onClick={reset}>立即进入下一位 ↻</button>}</div>}
  </main>;
}

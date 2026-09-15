import type { PoseVisualPoint, PoseVisuals } from "./usePose";

export type BeatState = {
  status: "off" | "permission" | "listening" | "fallback";
  source: "microphone" | "fallback";
  lastBeatAt: number;
  lowEnergy: number;
  bpm: number;
  confidence: number;
};

export type GestureKind = "drop" | "sweepLeft" | "sweepRight" | "open" | "surge";
export type GestureEvent = { id: number; kind: GestureKind; strength: number; at: number; onBeat: boolean };
export type ComboLevel = "idle" | "airflow" | "override" | "storm";
export type ComboState = { count: number; max: number; energy: number; level: ComboLevel; easterEggZh?: string };

export type HighlightData = { v: 1; fps: 8 | 4; count: number; frames: string };
export type HighlightSample = { at: number; score: number; points: Array<PoseVisualPoint | null> };

export const emptyBeat: BeatState = { status: "off", source: "fallback", lastBeatAt: 0, lowEnergy: 0, bpm: 120, confidence: 0 };
export const emptyCombo: ComboState = { count: 0, max: 0, energy: 0, level: "idle" };

export function comboLevel(count: number): ComboLevel {
  return count >= 8 ? "storm" : count >= 4 ? "override" : count >= 2 ? "airflow" : "idle";
}

const pointOrder = (visuals: PoseVisuals) => [
  visuals.nose,
  visuals.leftShoulder,
  visuals.rightShoulder,
  visuals.leftElbow,
  visuals.rightElbow,
  visuals.leftWrist,
  visuals.rightWrist,
  visuals.hipCenter,
];

export function normalizedHighlightPoints(visuals: PoseVisuals) {
  const left = visuals.leftShoulder, right = visuals.rightShoulder;
  if (!left || !right) return Array<PoseVisualPoint | null>(8).fill(null);
  const centerX = (left.x + right.x) / 2;
  const centerY = (left.y + right.y) / 2;
  const span = Math.max(.08, Math.abs(left.x - right.x));
  return pointOrder(visuals).map(point => point ? {
    x: Math.max(-2, Math.min(2, (point.x - centerX) / span)),
    y: Math.max(-2, Math.min(3, (point.y - centerY) / span)),
    visibility: point.visibility,
  } : null);
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64Url(value: string) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function encodeFrames(frames: HighlightSample[], fps: 8 | 4): HighlightData | undefined {
  if (!frames.length) return undefined;
  const bytes = new Uint8Array(frames.length * 17);
  frames.forEach((frame, frameIndex) => {
    let mask = 0;
    frame.points.forEach((point, pointIndex) => {
      if (!point || point.visibility < .3) return;
      mask |= 1 << pointIndex;
      const offset = frameIndex * 17 + 1 + pointIndex * 2;
      bytes[offset] = Math.round((point.x + 2) / 4 * 255);
      bytes[offset + 1] = Math.round((point.y + 2) / 5 * 255);
    });
    bytes[frameIndex * 17] = mask;
  });
  return { v: 1, fps, count: frames.length, frames: toBase64Url(bytes) };
}

export function selectHighlight(samples: HighlightSample[]): HighlightData | undefined {
  const length = 32;
  if (samples.length < 8) return undefined;
  let bestStart = 0, bestScore = -Infinity;
  for (let start = 0; start <= Math.max(0, samples.length - length); start++) {
    const window = samples.slice(start, start + length);
    const score = window.reduce((sum, sample) => sum + sample.score, 0) / window.length;
    if (score > bestScore) { bestScore = score; bestStart = start; }
  }
  const selected = samples.slice(bestStart, bestStart + length);
  while (selected.length < length) selected.push(selected[selected.length - 1]);
  return encodeFrames(selected, 8);
}

export function reduceHighlight(highlight: HighlightData): HighlightData | undefined {
  const decoded = decodeHighlight(highlight);
  if (!decoded) return undefined;
  const samples = decoded.filter((_, index) => index % 2 === 0).map(points => ({ at: 0, score: 0, points }));
  return encodeFrames(samples, 4);
}

export function decodeHighlight(highlight: HighlightData) {
  try {
    if (highlight.v !== 1 || ![4, 8].includes(highlight.fps) || highlight.count < 8 || highlight.count > 32 || !/^[A-Za-z0-9_-]+$/.test(highlight.frames)) return null;
    const bytes = fromBase64Url(highlight.frames);
    if (bytes.length !== highlight.count * 17) return null;
    return Array.from({ length: highlight.count }, (_, frameIndex) => {
      const mask = bytes[frameIndex * 17];
      return Array.from({ length: 8 }, (_, pointIndex): PoseVisualPoint | null => {
        if (!(mask & (1 << pointIndex))) return null;
        const offset = frameIndex * 17 + 1 + pointIndex * 2;
        return { x: bytes[offset] / 255 * 4 - 2, y: bytes[offset + 1] / 255 * 5 - 2, visibility: 1 };
      });
    });
  } catch { return null; }
}

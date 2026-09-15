import type { HighlightData } from "./interaction";

export const phases = ["WARM UP", "DEEP", "BUILD", "PEAK", "CLOSING"] as const;
export type Phase = (typeof phases)[number];
export type Signals = { movement: number; openness: number; stillness: number; pressure: number };
export type Conflict = { setup: string; payoff: string };

export const weatherVisualKinds = [
  "electricStorm", "openSky", "silentPressure", "localChaos", "tipsyMonsoon",
  "floorFog", "slowHeatwave", "neonCrosswind", "softThunder", "midnightInversion",
  "afterpartyRainbow", "dancefloorCurrent", "dancefloorSupercell", "onBeatAurora", "artificialSunrise",
] as const;
export type WeatherVisualKind = (typeof weatherVisualKinds)[number];
export type WeatherMaterial = "cloud" | "rain" | "fog" | "aurora" | "heat" | "caustics" | "spectrum" | "wind" | "pressure" | "lightning" | "sunrise" | "vortex";
export type DissolveStyle = "lightning" | "rays" | "pressure" | "shards" | "rain" | "fog" | "heat" | "wind" | "inversion" | "spectrum" | "current" | "vortex" | "aurora" | "sunrise";
export type WeatherPalette = { primary: string; secondary: string; accent: string; dark: string };

export type WeatherDefinition = {
  kind: WeatherVisualKind; name: string; nameZh: string; quoteZh: string; conflict: Conflict;
  palette: WeatherPalette; materials: WeatherMaterial[]; dissolveStyle: DissolveStyle;
  center?: Signals; rare?: "onBeat" | "supercell" | "sunrise";
};

export type Weather = {
  v: 1; seed: number; name: string; nameZh?: string; quote: string; quoteZh?: string;
  conflict?: Conflict; remarkZh?: string; date: string; phase: Phase; signals: Signals; demo: boolean;
  maxCombo?: number; onBeatCount?: number; easterEggZh?: string; highlight?: HighlightData;
  highlightCaptionZh?: string; visualKind?: WeatherVisualKind;
};

export const initial: Signals = { movement: 12, openness: 25, stillness: 88, pressure: 70 };
export const clamp = (n: number) => Math.max(0, Math.min(100, n));

export const weatherDefinitions: readonly WeatherDefinition[] = [
  { kind: "electricStorm", name: "ELECTRIC STORM", nameZh: "电子风暴", quoteZh: "嘴上说来坐坐，身体申请常驻。", conflict: { setup: "本人声明：来坐坐。", payoff: "身体已提交常驻申请。" }, center: { movement: 92, openness: 55, stillness: 10, pressure: 48 }, palette: { primary: "#ff3fae", secondary: "#7357ff", accent: "#d9f7ff", dark: "#080316" }, materials: ["cloud", "rain", "lightning"], dissolveStyle: "lightning" },
  { kind: "openSky", name: "OPEN SKY", nameZh: "全场放晴", quoteZh: "双手一开，默认自己是压轴。", conflict: { setup: "本人声明：伸个懒腰。", payoff: "系统已为你预留压轴位。" }, center: { movement: 48, openness: 94, stillness: 34, pressure: 42 }, palette: { primary: "#ffb34f", secondary: "#41efbd", accent: "#fff2bd", dark: "#07191a" }, materials: ["aurora", "sunrise"], dissolveStyle: "rays" },
  { kind: "silentPressure", name: "SILENT PRESSURE", nameZh: "静默高压", quoteZh: "你没跳。你在给舞池压阵。", conflict: { setup: "系统检测：舞池出现静止物体。", payoff: "更正：这是定海神针。" }, center: { movement: 10, openness: 25, stillness: 94, pressure: 84 }, palette: { primary: "#4777c9", secondary: "#7da5da", accent: "#c7ddf5", dark: "#040914" }, materials: ["cloud", "fog", "pressure"], dissolveStyle: "pressure" },
  { kind: "localChaos", name: "LOCAL CHAOS", nameZh: "局部失控", quoteZh: "理智间歇在线，身体全程包月。", conflict: { setup: "本人声明：我有分寸。", payoff: "系统未找到分寸的定位。" }, center: { movement: 62, openness: 48, stillness: 32, pressure: 58 }, palette: { primary: "#caff38", secondary: "#a13cff", accent: "#efffc0", dark: "#0c0614" }, materials: ["vortex", "wind"], dissolveStyle: "shards" },
  { kind: "tipsyMonsoon", name: "TIPSY MONSOON", nameZh: "微醺季风", quoteZh: "看起来很克制，鞋底另有打算。", conflict: { setup: "本人声明：今天很克制。", payoff: "鞋底对此提出异议。" }, center: { movement: 30, openness: 46, stillness: 66, pressure: 50 }, palette: { primary: "#ff719f", secondary: "#5ec8d8", accent: "#ffd6de", dark: "#110712" }, materials: ["rain", "fog", "caustics"], dissolveStyle: "rain" },
  { kind: "floorFog", name: "FLOOR FOG", nameZh: "地板雾", quoteZh: "本人说没动。雾说你把地板占满了。", conflict: { setup: "本人声明：我一直站着。", payoff: "雾说你把地板占满了。" }, center: { movement: 7, openness: 48, stillness: 95, pressure: 22 }, palette: { primary: "#d8c8ff", secondary: "#8a67d8", accent: "#f5f0ff", dark: "#090713" }, materials: ["fog", "pressure"], dissolveStyle: "fog" },
  { kind: "slowHeatwave", name: "SLOW HEATWAVE", nameZh: "慢速热浪", quoteZh: "动作不快。温度很有意见。", conflict: { setup: "系统检测：动作温和。", payoff: "温度很有意见。" }, center: { movement: 34, openness: 74, stillness: 60, pressure: 18 }, palette: { primary: "#ff9a3d", secondary: "#ff477e", accent: "#ffe2a8", dark: "#160905" }, materials: ["heat", "sunrise"], dissolveStyle: "heat" },
  { kind: "neonCrosswind", name: "NEON CROSSWIND", nameZh: "霓虹侧风", quoteZh: "你只是晃过去。隔壁气候被顺走了。", conflict: { setup: "本人声明：只是路过。", payoff: "隔壁气候被顺走了。" }, center: { movement: 70, openness: 20, stillness: 25, pressure: 46 }, palette: { primary: "#27f4c2", secondary: "#11a8ff", accent: "#c9fff1", dark: "#031216" }, materials: ["wind", "fog"], dissolveStyle: "wind" },
  { kind: "softThunder", name: "SOFT THUNDER", nameZh: "柔软雷阵雨", quoteZh: "看起来很温柔。音响先打了雷。", conflict: { setup: "本人声明：今天走温柔路线。", payoff: "音响先打了雷。" }, center: { movement: 72, openness: 72, stillness: 24, pressure: 32 }, palette: { primary: "#ff83c7", secondary: "#906cff", accent: "#fff0fa", dark: "#10071a" }, materials: ["cloud", "rain", "lightning"], dissolveStyle: "lightning" },
  { kind: "midnightInversion", name: "MIDNIGHT INVERSION", nameZh: "午夜逆温", quoteZh: "夜越深，你的气压越不讲道理。", conflict: { setup: "系统尝试按常理理解你。", payoff: "你的气压决定倒着来。" }, center: { movement: 30, openness: 24, stillness: 58, pressure: 95 }, palette: { primary: "#ff704d", secondary: "#397bff", accent: "#dce8ff", dark: "#050817" }, materials: ["cloud", "rain", "pressure"], dissolveStyle: "inversion" },
  { kind: "afterpartyRainbow", name: "AFTERPARTY RAINBOW", nameZh: "醉后彩虹", quoteZh: "你说准备回家。天空已经开始返场。", conflict: { setup: "本人声明：这首结束就走。", payoff: "天空已经开始返场。" }, center: { movement: 20, openness: 92, stillness: 74, pressure: 20 }, palette: { primary: "#ff5fa2", secondary: "#4df4cf", accent: "#ffe95c", dark: "#0d0914" }, materials: ["spectrum", "fog", "rain"], dissolveStyle: "spectrum" },
  { kind: "dancefloorCurrent", name: "DANCEFLOOR CURRENT", nameZh: "舞池暗流", quoteZh: "人还在原地。暗流已经到下一首。", conflict: { setup: "本人声明：我还在原地。", payoff: "暗流已经到下一首。" }, center: { movement: 50, openness: 50, stillness: 44, pressure: 88 }, palette: { primary: "#19d9c2", secondary: "#126e91", accent: "#bafff6", dark: "#031116" }, materials: ["caustics", "wind", "pressure"], dissolveStyle: "current" },
  { kind: "dancefloorSupercell", name: "DANCEFLOOR SUPERCELL", nameZh: "舞池超级风暴", quoteZh: "本人只连了八下。气象台开始加班。", conflict: { setup: "系统原本只想记录动作。", payoff: "气象台开始加班。" }, rare: "supercell", palette: { primary: "#ff2b91", secondary: "#643cff", accent: "#e6fbff", dark: "#07020f" }, materials: ["cloud", "vortex", "lightning"], dissolveStyle: "vortex" },
  { kind: "onBeatAurora", name: "ON-BEAT AURORA", nameZh: "踩点极光", quoteZh: "你没有追节拍。节拍申请跟随你。", conflict: { setup: "本人声明：只是碰巧踩中。", payoff: "节拍申请跟随你。" }, rare: "onBeat", palette: { primary: "#32ffd2", secondary: "#b537ff", accent: "#efffff", dark: "#03100f" }, materials: ["aurora", "pressure"], dissolveStyle: "aurora" },
  { kind: "artificialSunrise", name: "ARTIFICIAL SUNRISE", nameZh: "人造日出", quoteZh: "只是张开双手。北京提前亮了一次。", conflict: { setup: "本人声明：只是张开双手。", payoff: "北京提前亮了一次。" }, rare: "sunrise", palette: { primary: "#ffc247", secondary: "#ff5b4d", accent: "#fff7d1", dark: "#160803" }, materials: ["sunrise", "cloud", "aurora"], dissolveStyle: "sunrise" },
] as const;

const definitionByKind = new Map(weatherDefinitions.map(definition => [definition.kind, definition]));
const definitionByName = new Map(weatherDefinitions.map(definition => [definition.name, definition]));
const commonDefinitions = weatherDefinitions.filter(definition => definition.center);

export function weatherDefinition(kind: WeatherVisualKind) { return definitionByKind.get(kind)!; }
export function weatherDefinitionForName(name: string) { return definitionByName.get(name) ?? null; }

export function classifyWeather(signals: Signals, performance: { maxCombo?: number; onBeatCount?: number } = {}) {
  const maxCombo = performance.maxCombo ?? 0, onBeatCount = performance.onBeatCount ?? 0;
  if (onBeatCount >= 4 && maxCombo >= 4) return weatherDefinition("onBeatAurora");
  if (maxCombo >= 8 && signals.movement >= 70) return weatherDefinition("dancefloorSupercell");
  if (maxCombo >= 6 && signals.openness >= 85) return weatherDefinition("artificialSunrise");
  const weights: Signals = { movement: 1.15, openness: 1, stillness: .7, pressure: .9 };
  let winner = commonDefinitions[0], best = Infinity;
  for (const definition of commonDefinitions) {
    const center = definition.center!;
    const distance = (Object.keys(weights) as Array<keyof Signals>).reduce((sum, key) => sum + Math.pow((signals[key] - center[key]) / 100, 2) * weights[key], 0);
    if (distance < best) { best = distance; winner = definition; }
  }
  return winner;
}

export function conflictFor(signals: Signals, performance?: { maxCombo?: number; onBeatCount?: number }): Conflict { return classifyWeather(signals, performance).conflict; }
export function shareCopyFor(signals: Signals, performance?: { maxCombo?: number; onBeatCount?: number }) { const d = classifyWeather(signals, performance); return { line: d.quoteZh, nameZh: d.nameZh, name: d.name }; }
export function visualKindForName(name: string): WeatherVisualKind | null { return weatherDefinitionForName(name)?.kind ?? null; }
export function weatherVisualKind(weather: Pick<Weather, "name" | "signals" | "visualKind" | "maxCombo" | "onBeatCount">): WeatherVisualKind {
  if (weather.visualKind && weatherVisualKinds.includes(weather.visualKind)) return weather.visualKind;
  return visualKindForName(weather.name) || classifyWeather(weather.signals, weather).kind;
}

export function weatherRemark(weather: Weather) { const remarks = ["影响范围：本人及旁边两位。", "预计消散：下一首结束后。此预测已连续失效。", "建议措施：补水。不要补班。"]; return weather.remarkZh || remarks[weather.seed % remarks.length]; }
export function weatherShareText(weather: Weather) {
  const combo = weather.maxCombo && weather.maxCombo > 1 ? `\n天气连招：×${weather.maxCombo}` : "";
  const beat = weather.onBeatCount ? `\n踩中节拍：×${weather.onBeatCount}` : "";
  const egg = weather.easterEggZh ? `\n系统事件：${weather.easterEggZh}` : "";
  return `${weatherQuoteZh(weather)}\n今晚天气：${weatherNameZh(weather)}${combo}${beat}${egg}\n${weatherRemark(weather)}\nRAVE WEATHER · 今晚现场鉴定`;
}

const modifiers = [["MIDNIGHT", "午夜"], ["ELECTRIC", "电子"], ["AFTER", "余温"], ["SILENT", "静默"], ["SOFT", "柔软"], ["SLOW", "缓慢"], ["NEON", "霓虹"], ["DEEP", "深层"]] as const;
const weatherWords = { FOG: "雾", DRIFT: "漂移", CURRENT: "暗流", STORM: "风暴", GLOW: "微光", WIND: "风", CLOUD: "云", PULSE: "脉冲", SKY: "天空" } as const;
export function chineseNameFromEnglish(name: string) { const known = weatherDefinitionForName(name); if (known) return known.nameZh; const [modifier = "DEEP", weather = "DRIFT"] = name.split(" "); return `${modifiers.find(([english]) => english === modifier)?.[1] ?? "深层"}${weatherWords[weather as keyof typeof weatherWords] ?? "漂移"}`; }
export function weatherNameZh(weather: Weather) { return weather.nameZh || chineseNameFromEnglish(weather.name); }
export function weatherQuoteZh(weather: Weather) { return weather.quoteZh || weather.conflict?.payoff || weatherDefinitionForName(weather.name)?.quoteZh || conflictFor(weather.signals, weather).payoff; }
export function weatherConflict(weather: Weather) { return weather.conflict || weatherDefinitionForName(weather.name)?.conflict || conflictFor(weather.signals, weather); }

const qrEggs = ["天气越权", "临时主舞台", "附近气候受到牵连"] as const;
const base36 = (value: number) => Math.round(value).toString(36);

/** A short, camera-friendly result hash. Highlight frames stay in the full copy link. */
export function encodeWeatherQrHash(weather: Weather) {
  const kind = weatherVisualKind(weather);
  const eggIndex = weather.easterEggZh ? qrEggs.indexOf(weather.easterEggZh as typeof qrEggs[number]) : -1;
  return [
    "rw2",
    base36(weather.seed),
    base36(weatherVisualKinds.indexOf(kind)),
    base36(phases.indexOf(weather.phase)),
    base36(weather.signals.movement),
    base36(weather.signals.openness),
    base36(weather.signals.stillness),
    base36(weather.signals.pressure),
    weather.demo ? "1" : "0",
    base36(weather.maxCombo ?? 0),
    base36(weather.onBeatCount ?? 0),
    eggIndex >= 0 ? base36(eggIndex) : "-",
  ].join(".");
}

function decodeQrWeather(hash: string): Weather | null {
  const parts = hash.replace(/^#/, "").split(".");
  if (parts.length !== 12 || parts[0] !== "rw2") return null;
  const read = (index: number) => Number.parseInt(parts[index], 36);
  const seed = read(1), kindIndex = read(2), phaseIndex = read(3);
  const signals: Signals = { movement: read(4), openness: read(5), stillness: read(6), pressure: read(7) };
  const maxCombo = read(9), onBeatCount = read(10), eggIndex = parts[11] === "-" ? -1 : read(11);
  if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295 || !weatherVisualKinds[kindIndex] || !phases[phaseIndex]) return null;
  if (!Object.values(signals).every(value => Number.isInteger(value) && value >= 0 && value <= 100)) return null;
  if (!["0", "1"].includes(parts[8]) || !Number.isInteger(maxCombo) || maxCombo < 0 || maxCombo > 99 || !Number.isInteger(onBeatCount) || onBeatCount < 0 || onBeatCount > 99 || eggIndex < -1 || eggIndex >= qrEggs.length) return null;
  const definition = weatherDefinition(weatherVisualKinds[kindIndex]);
  const weather: Weather = {
    v: 1, seed, name: definition.name, nameZh: definition.nameZh, quote: definition.quoteZh,
    quoteZh: definition.quoteZh, conflict: definition.conflict, date: new Date().toISOString(),
    phase: phases[phaseIndex], signals, demo: parts[8] === "1", visualKind: definition.kind,
    ...(maxCombo ? { maxCombo } : {}), ...(onBeatCount ? { onBeatCount } : {}),
    ...(eggIndex >= 0 ? { easterEggZh: qrEggs[eggIndex] } : {}),
  };
  weather.remarkZh = weatherRemark(weather);
  return weather;
}

type WeatherExtras = Pick<Weather, "maxCombo" | "onBeatCount" | "easterEggZh" | "highlight" | "highlightCaptionZh"> & { seed?: number };
export function createWeather(signals: Signals, phase: Phase, demo: boolean, extras: WeatherExtras = {}): Weather {
  const seed = extras.seed ?? crypto.getRandomValues(new Uint32Array(1))[0], definition = classifyWeather(signals, extras);
  return { v: 1, seed, name: definition.name, nameZh: definition.nameZh, quote: definition.quoteZh, quoteZh: definition.quoteZh, remarkZh: weatherRemark({ seed } as Weather), conflict: definition.conflict, date: new Date().toISOString(), phase, signals, demo, visualKind: definition.kind,
    ...(extras.maxCombo ? { maxCombo: extras.maxCombo } : {}), ...(extras.onBeatCount ? { onBeatCount: extras.onBeatCount } : {}), ...(extras.easterEggZh ? { easterEggZh: extras.easterEggZh } : {}), ...(extras.highlight ? { highlight: extras.highlight } : {}), ...(extras.highlightCaptionZh ? { highlightCaptionZh: extras.highlightCaptionZh } : {}) };
}

function validOptionalText(value: unknown, max: number) { return value === undefined || (typeof value === "string" && value.length > 0 && value.length <= max); }
export function decodeWeather(hash: string): Weather | null {
  try {
    if (hash.replace(/^#/, "").startsWith("rw2.")) return decodeQrWeather(hash);
    const w = JSON.parse(decodeURIComponent(hash.replace(/^#/, "")));
    if (w.v !== 1 || !Number.isInteger(w.seed) || w.seed < 0 || w.seed > 4294967295 || !phases.includes(w.phase) || typeof w.demo !== "boolean" || typeof w.name !== "string" || !/^[A-Z -]{3,40}$/.test(w.name) || typeof w.quote !== "string" || w.quote.length > 160 || !Number.isFinite(Date.parse(w.date))) return null;
    if (!["movement", "openness", "stillness", "pressure"].every(k => typeof w.signals?.[k] === "number" && w.signals[k] >= 0 && w.signals[k] <= 100)) return null;
    if (!validOptionalText(w.nameZh, 40) || !validOptionalText(w.quoteZh, 160) || !validOptionalText(w.remarkZh, 100) || !validOptionalText(w.easterEggZh, 40) || !validOptionalText(w.highlightCaptionZh, 100)) return null;
    if (w.maxCombo !== undefined && (!Number.isInteger(w.maxCombo) || w.maxCombo < 0 || w.maxCombo > 99)) return null;
    if (w.onBeatCount !== undefined && (!Number.isInteger(w.onBeatCount) || w.onBeatCount < 0 || w.onBeatCount > 99)) return null;
    if (w.visualKind !== undefined && !weatherVisualKinds.includes(w.visualKind)) return null;
    if (w.highlight !== undefined && (!w.highlight || w.highlight.v !== 1 || ![4, 8].includes(w.highlight.fps) || !Number.isInteger(w.highlight.count) || w.highlight.count < 8 || w.highlight.count > 32 || typeof w.highlight.frames !== "string" || w.highlight.frames.length > 850 || !/^[A-Za-z0-9_-]+$/.test(w.highlight.frames))) return null;
    if (w.conflict !== undefined && (!w.conflict || typeof w.conflict.setup !== "string" || w.conflict.setup.length === 0 || w.conflict.setup.length > 100 || typeof w.conflict.payoff !== "string" || w.conflict.payoff.length === 0 || w.conflict.payoff.length > 100)) return null;
    return w;
  } catch { return null; }
}

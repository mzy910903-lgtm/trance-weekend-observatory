import { weatherDefinitions, type Signals, type WeatherPalette, type WeatherVisualKind } from "./weather";

export type WeatherSceneOptions = {
  kind: WeatherVisualKind;
  signals: Signals;
  seed: number;
  time: number;
  intensity?: number;
  reducedMotion?: boolean;
  motionCue?: WeatherMotionCue;
};

export type WeatherMotionCue = {
  energy: number;
  direction: number;
  expansion: number;
};

export const weatherPalettes = Object.fromEntries(weatherDefinitions.map(definition => [definition.kind, definition.palette])) as Record<WeatherVisualKind, WeatherPalette>;

const TAU = Math.PI * 2;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const fract = (value: number) => value - Math.floor(value);
const random = (seed: number, index: number) => fract(Math.sin(seed * .000137 + index * 12.9898) * 43758.5453123);

function fillBackground(ctx: CanvasRenderingContext2D, width: number, height: number, kind: WeatherVisualKind) {
  const palette = weatherPalettes[kind];
  const gradient = ctx.createRadialGradient(width * .5, height * .43, 0, width * .5, height * .48, Math.max(width, height) * .78);
  gradient.addColorStop(0, palette.dark);
  gradient.addColorStop(.55, "#07090f");
  gradient.addColorStop(1, "#020304");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function glowEllipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string, alpha: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  glow.addColorStop(0, `${color}${Math.round(clamp01(alpha) * 255).toString(16).padStart(2, "0")}`);
  glow.addColorStop(1, `${color}00`);
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(0, 0, rx, 0, TAU); ctx.fill();
  ctx.restore();
}

function drawCloudVolume(ctx: CanvasRenderingContext2D, width: number, height: number, seed: number, loop: number, primary: string, secondary: string, density = 1) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const count = Math.round(10 * density);
  for (let index = 0; index < count; index++) {
    const drift = Math.sin(loop * TAU + index * .77) * width * .014;
    const x = width * (-.05 + random(seed, index + 1500) * 1.1) + drift;
    const y = height * (.12 + random(seed, index + 1530) * .3);
    const rx = width * (.12 + random(seed, index + 1560) * .2);
    const ry = height * (.055 + random(seed, index + 1590) * .09);
    glowEllipse(ctx, x, y, rx, ry, index % 3 ? primary : secondary, .055 + density * .035);
  }
  ctx.globalAlpha = .13;
  ctx.strokeStyle = primary;
  ctx.lineWidth = Math.max(1, height * .0014);
  for (let contour = 0; contour < 4; contour++) {
    const y = height * (.24 + contour * .055);
    ctx.beginPath(); ctx.moveTo(-width * .08, y);
    ctx.bezierCurveTo(width * .22, y - height * (.08 + contour * .008), width * .32, y + height * .055, width * .55, y - height * .02);
    ctx.bezierCurveTo(width * .72, y - height * .075, width * .84, y + height * .04, width * 1.08, y - height * .025); ctx.stroke();
  }
  ctx.restore();
}

function drawSoftRibbon(ctx: CanvasRenderingContext2D, width: number, height: number, y: number, bend: number, color: string, alpha: number, thickness: number, phase: number) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = color; ctx.globalAlpha = alpha; ctx.lineCap = "round";
  ctx.shadowColor = color; ctx.shadowBlur = thickness * .8;
  ctx.beginPath(); ctx.moveTo(-width * .12, y + Math.sin(phase) * bend);
  ctx.bezierCurveTo(width * .18, y - bend, width * .34, y + bend * 1.2, width * .53, y - bend * .25);
  ctx.bezierCurveTo(width * .72, y - bend, width * .86, y + bend, width * 1.12, y - Math.cos(phase) * bend);
  ctx.lineWidth = thickness; ctx.stroke();
  ctx.globalAlpha = alpha * .85; ctx.lineWidth = Math.max(1, thickness * .055); ctx.strokeStyle = "#ffffff"; ctx.shadowBlur = thickness * .22; ctx.stroke();
  ctx.restore();
}

function drawOpticalFinish(ctx: CanvasRenderingContext2D, width: number, height: number, kind: WeatherVisualKind, seed: number, energy: number) {
  const palette = weatherPalettes[kind];
  const bloom = ctx.createRadialGradient(width * .5, height * .48, 0, width * .5, height * .48, Math.max(width, height) * .62);
  bloom.addColorStop(0, `${palette.primary}13`); bloom.addColorStop(.52, `${palette.secondary}08`); bloom.addColorStop(1, "rgba(0,0,0,.48)");
  ctx.fillStyle = bloom; ctx.fillRect(0, 0, width, height);
  ctx.save(); ctx.globalCompositeOperation = "soft-light";
  const grainCount = Math.max(28, Math.round(width * height / 42000));
  for (let index = 0; index < grainCount; index++) {
    const x = random(seed, index + 1700) * width;
    const y = random(seed, index + 1760) * height;
    const length = 2 + random(seed, index + 1800) * 8;
    ctx.globalAlpha = .025 + energy * .018; ctx.strokeStyle = index % 2 ? palette.accent : "#ffffff";
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + length, y + length * .18); ctx.stroke();
  }
  ctx.restore();
}

function drawLightning(ctx: CanvasRenderingContext2D, seed: number, x: number, y: number, length: number, color: string, alpha: number, branches: boolean) {
  const points: Array<{ x: number; y: number }> = [{ x, y }];
  for (let index = 1; index <= 8; index++) {
    points.push({ x: x + (random(seed, index) - .5) * length * .24, y: y + length * index / 8 });
  }
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = color; ctx.globalAlpha = alpha; ctx.lineWidth = Math.max(1, length * .012); ctx.shadowColor = color; ctx.shadowBlur = 18;
  ctx.beginPath(); points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)); ctx.stroke();
  if (branches) {
    ctx.globalAlpha *= .62; ctx.lineWidth *= .55;
    [3, 5, 6].forEach((pointIndex, branchIndex) => {
      const point = points[pointIndex];
      const direction = random(seed, branchIndex + 30) > .5 ? 1 : -1;
      ctx.beginPath(); ctx.moveTo(point.x, point.y);
      ctx.lineTo(point.x + direction * length * (.12 + random(seed, branchIndex + 40) * .12), point.y + length * .16); ctx.stroke();
    });
  }
  ctx.restore();
}

function drawElectricStorm(ctx: CanvasRenderingContext2D, width: number, height: number, options: WeatherSceneOptions, motion: number, energy: number, loop: number) {
  const palette = weatherPalettes.electricStorm;
  const wave = Math.sin(loop * TAU);
  drawCloudVolume(ctx, width, height, options.seed, loop, palette.secondary, palette.primary, 1.25);
  for (let index = 0; index < 9; index++) {
    const x = width * (random(options.seed, index) * 1.2 - .1) + wave * width * .018 * (index % 2 ? 1 : -1);
    const y = height * (.12 + random(options.seed, index + 12) * .3);
    glowEllipse(ctx, x, y, width * (.18 + random(options.seed, index + 20) * .18), height * (.1 + random(options.seed, index + 31) * .1), index % 2 ? palette.primary : palette.secondary, .08 + energy * .08);
  }
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  const rainCount = options.reducedMotion ? 55 : Math.round(100 + motion * 90);
  ctx.lineWidth = Math.max(1, width / 900);
  for (let index = 0; index < rainCount; index++) {
    const x = random(options.seed, index + 100) * width;
    const y = fract(random(options.seed, index + 310) + loop * (2 + index % 3)) * height * 1.15 - height * .1;
    const length = height * (.018 + random(options.seed, index + 500) * .055);
    ctx.globalAlpha = .08 + random(options.seed, index + 620) * .24;
    ctx.strokeStyle = index % 5 ? palette.secondary : palette.primary;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + length * .65, y + length); ctx.stroke();
  }
  ctx.restore();
  if (!options.reducedMotion) {
    const strike = Math.pow(Math.max(0, Math.sin(loop * TAU * 4 + options.seed % 9)), 18);
    if (strike > .08) {
      ctx.fillStyle = `rgba(231,219,255,${strike * .11 * energy})`; ctx.fillRect(0, 0, width, height);
      drawLightning(ctx, options.seed + Math.floor(loop * 16), width * (.27 + random(options.seed, 711) * .46), height * .05, height * .62, palette.accent, strike * .9, true);
    }
  }
}

function drawOpenSky(ctx: CanvasRenderingContext2D, width: number, height: number, options: WeatherSceneOptions, openness: number, energy: number, loop: number) {
  const palette = weatherPalettes.openSky;
  const horizon = height * .62;
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "rgba(10,65,62,.24)"); sky.addColorStop(.58, "rgba(255,151,46,.08)"); sky.addColorStop(1, "rgba(4,7,10,0)");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, width, height);
  glowEllipse(ctx, width * .5, horizon, width * (.42 + openness * .14), height * .26, palette.primary, .13 + energy * .08);
  ctx.save(); ctx.translate(width * .5, horizon); ctx.globalCompositeOperation = "lighter";
  const rayCount = options.reducedMotion ? 5 : 9;
  for (let index = 0; index < rayCount; index++) {
    const angle = -.9 + index / Math.max(1, rayCount - 1) * 1.8 + Math.sin(loop * TAU + index) * .025;
    const spread = width * (.04 + openness * .045);
    ctx.globalAlpha = (.025 + energy * .035) * (1 - Math.abs(index - rayCount / 2) / rayCount);
    ctx.fillStyle = index % 2 ? palette.primary : palette.accent;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.sin(angle) * height - spread, -Math.cos(angle) * height); ctx.lineTo(Math.sin(angle) * height + spread, -Math.cos(angle) * height); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round";
  for (let band = 0; band < 5; band++) {
    const y = height * (.18 + band * .085);
    ctx.beginPath(); ctx.moveTo(-width * .1, y);
    for (let step = 0; step <= 8; step++) {
      const x = width * step / 8;
      const drift = Math.sin(step * .82 + loop * TAU + band * .7) * height * (.025 + band * .004);
      ctx.lineTo(x, y + drift);
    }
    ctx.globalAlpha = .11 + energy * .055; ctx.strokeStyle = band % 2 ? palette.secondary : palette.primary;
    ctx.lineWidth = height * (.035 + band * .01); ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = height * .04; ctx.stroke();
  }
  ctx.restore();
  for (let band = 0; band < 4; band++) {
    drawSoftRibbon(ctx, width, height, height * (.19 + band * .105), height * (.035 + band * .009), band % 2 ? palette.secondary : palette.primary, .055 + energy * .035, height * (.035 + band * .012), loop * TAU + band);
  }
  glowEllipse(ctx, width * .5, horizon, width * (.32 + openness * .12), height * .22, palette.primary, .12 + energy * .08);
}

function drawSilentPressure(ctx: CanvasRenderingContext2D, width: number, height: number, options: WeatherSceneOptions, stillness: number, energy: number, loop: number) {
  const palette = weatherPalettes.silentPressure;
  const breathing = options.reducedMotion ? 0 : Math.sin(loop * TAU) * height * .008;
  ctx.save(); ctx.globalCompositeOperation = "screen";
  for (let band = 0; band < 8; band++) {
    const y = height * (.18 + band * .075) + breathing * (band % 2 ? 1 : -1);
    const fog = ctx.createLinearGradient(0, y, 0, y + height * .16);
    fog.addColorStop(0, "rgba(73,113,180,0)"); fog.addColorStop(.5, `rgba(85,126,190,${.035 + stillness * .07})`); fog.addColorStop(1, "rgba(40,65,105,0)");
    ctx.fillStyle = fog; ctx.beginPath(); ctx.moveTo(0, y);
    for (let step = 0; step <= 12; step++) {
      const x = width * step / 12;
      ctx.lineTo(x, y + Math.sin(step * .73 + band + loop * TAU) * height * .012);
    }
    ctx.lineTo(width, y + height * .18); ctx.lineTo(0, y + height * .18); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  for (let band = 0; band < 4; band++) {
    drawSoftRibbon(ctx, width, height, height * (.36 + band * .11), height * .018, band % 2 ? palette.secondary : palette.primary, .035 + stillness * .035, height * (.045 + band * .016), loop * TAU * .35 + band);
  }
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.strokeStyle = palette.accent;
  for (let ring = 0; ring < 6; ring++) {
    const cycle = fract(loop + ring / 6);
    ctx.globalAlpha = (1 - cycle) * (.1 + energy * .07);
    ctx.lineWidth = Math.max(1, width / 1000);
    ctx.beginPath(); ctx.ellipse(width * .5, height * .48, width * (.08 + cycle * .42), height * (.028 + cycle * .14), 0, 0, TAU); ctx.stroke();
  }
  ctx.restore();
  const ceiling = ctx.createLinearGradient(0, 0, 0, height * .42);
  ceiling.addColorStop(0, "rgba(12,22,48,.82)"); ceiling.addColorStop(1, "rgba(38,65,105,0)");
  ctx.fillStyle = ceiling; ctx.fillRect(0, 0, width, height * .48);
}

function drawLocalChaos(ctx: CanvasRenderingContext2D, width: number, height: number, options: WeatherSceneOptions, motion: number, energy: number, loop: number) {
  const palette = weatherPalettes.localChaos;
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round";
  for (let ribbon = 0; ribbon < 14; ribbon++) {
    const direction = ribbon % 2 ? 1 : -1;
    const centerX = width * (.5 + Math.sin(loop * TAU * direction + ribbon) * .17);
    const centerY = height * (.46 + Math.cos(loop * TAU + ribbon * .9) * .13);
    const radius = Math.min(width, height) * (.08 + ribbon * .018);
    ctx.beginPath();
    for (let step = 0; step <= 24; step++) {
      const angle = step / 24 * TAU * (1.2 + motion) + ribbon + loop * TAU * direction;
      const r = radius * (step / 24 + .25);
      const x = centerX + Math.cos(angle) * r * 1.8;
      const y = centerY + Math.sin(angle) * r * .74;
      if (step) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.strokeStyle = ribbon % 3 ? palette.secondary : palette.primary; ctx.globalAlpha = .08 + energy * .08;
    ctx.lineWidth = Math.max(1.5, height * (.002 + (ribbon % 4) * .0015)); ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 14; ctx.stroke();
  }
  if (!options.reducedMotion) {
    for (let index = 0; index < 52; index++) {
      const x = fract(random(options.seed, index + 20) + loop * (index % 2 ? 2 : -2)) * width;
      const y = random(options.seed, index + 90) * height;
      const size = 4 + random(options.seed, index + 130) * Math.min(width, height) * .025;
      ctx.globalAlpha = .08 + random(options.seed, index + 180) * .25;
      ctx.fillStyle = index % 3 ? palette.primary : palette.secondary;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + size, y - size * .25); ctx.lineTo(x + size * .55, y + size * .48); ctx.closePath(); ctx.fill();
    }
  }
  ctx.restore();
  const voidGlow = ctx.createRadialGradient(width * .5, height * .46, 0, width * .5, height * .46, Math.min(width, height) * .34);
  voidGlow.addColorStop(0, "rgba(0,0,0,.78)"); voidGlow.addColorStop(.62, `${palette.secondary}13`); voidGlow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = voidGlow; ctx.fillRect(0, 0, width, height);
}

function drawTipsyMonsoon(ctx: CanvasRenderingContext2D, width: number, height: number, options: WeatherSceneOptions, motion: number, energy: number, loop: number) {
  const palette = weatherPalettes.tipsyMonsoon;
  for (let band = 0; band < 7; band++) {
    const y = height * (.18 + band * .11) + Math.sin(loop * TAU + band) * height * .012;
    glowEllipse(ctx, width * (.25 + random(options.seed, band) * .5), y, width * .32, height * .09, band % 2 ? palette.primary : palette.secondary, .055 + energy * .035);
  }
  ctx.save(); ctx.globalCompositeOperation = "screen";
  for (let sheet = 0; sheet < 5; sheet++) {
    const x = width * (-.18 + sheet * .28 + Math.sin(loop * TAU + sheet) * .025);
    const wash = ctx.createLinearGradient(x, 0, x + width * .22, height);
    wash.addColorStop(0, "rgba(255,113,159,0)"); wash.addColorStop(.5, sheet % 2 ? "rgba(94,200,216,.055)" : "rgba(255,113,159,.06)"); wash.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = wash; ctx.transform(1, 0, -.18, 1, 0, 0); ctx.fillRect(x, 0, width * .18, height); ctx.resetTransform();
  }
  ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round";
  const count = options.reducedMotion ? 60 : Math.round(115 + motion * 85);
  for (let index = 0; index < count; index++) {
    const x = fract(random(options.seed, index + 250) + loop * (index % 3 + 1)) * width * 1.2 - width * .1;
    const y = fract(random(options.seed, index + 460) + loop * (index % 4 + 1)) * height * 1.15 - height * .1;
    const length = height * (.02 + random(options.seed, index + 680) * .08);
    ctx.strokeStyle = index % 4 ? palette.secondary : palette.primary; ctx.globalAlpha = .08 + random(options.seed, index + 820) * .28;
    ctx.lineWidth = 1 + random(options.seed, index + 900) * 2.2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + length * .22, y + length * .45, x + length * .48, y + length); ctx.stroke();
  }
  for (let ring = 0; ring < 8; ring++) {
    const cycle = fract(loop * (ring % 2 + 1) + random(options.seed, ring + 980));
    ctx.globalAlpha = (1 - cycle) * .18; ctx.strokeStyle = ring % 2 ? palette.primary : palette.accent; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.ellipse(random(options.seed, ring + 1010) * width, height * (.45 + random(options.seed, ring + 1040) * .4), width * cycle * .13, height * cycle * .038, 0, 0, TAU); ctx.stroke();
  }
  ctx.restore();
}

function drawFogBands(ctx: CanvasRenderingContext2D, width: number, height: number, options: WeatherSceneOptions, floor = false) {
  const palette = weatherPalettes[options.kind];
  ctx.save(); ctx.globalCompositeOperation = "screen";
  for (let band = 0; band < 9; band++) {
    const base = floor ? .58 + band * .045 : .18 + band * .075;
    const y = height * base + Math.sin(loopAngle(options.time, band)) * height * .012;
    drawSoftRibbon(ctx, width, height, y, height * (.018 + band * .003), band % 2 ? palette.primary : palette.secondary, .05 + band * .006, height * (.035 + band * .008), loopAngle(options.time * .35, band));
  }
  ctx.restore();
}

function loopAngle(time: number, offset = 0) { return time / 4 * TAU + offset * .83; }

function drawRain(ctx: CanvasRenderingContext2D, width: number, height: number, options: WeatherSceneOptions, loop: number, count: number, rise = false, slant = .2) {
  const palette = weatherPalettes[options.kind];
  const direction = clamp01((options.motionCue?.direction ?? 0) * .5 + .5) * 2 - 1;
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round";
  const actual = options.reducedMotion ? Math.round(count * .42) : count;
  for (let index = 0; index < actual; index++) {
    const x = fract(random(options.seed, index + 2100) + loop * (slant + direction * .16)) * width * 1.15 - width * .08;
    const travel = fract(random(options.seed, index + 2200) + loop * (1.2 + index % 4));
    const y = (rise ? 1 - travel : travel) * height * 1.15 - height * .08;
    const length = height * (.012 + random(options.seed, index + 2300) * .052);
    ctx.globalAlpha = .08 + random(options.seed, index + 2400) * .28; ctx.strokeStyle = index % 5 ? palette.secondary : palette.primary;
    ctx.lineWidth = 1 + random(options.seed, index + 2500) * 1.8; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + length * slant, y + (rise ? -length : length)); ctx.stroke();
  }
  ctx.restore();
}

function drawPressureRings(ctx: CanvasRenderingContext2D, width: number, height: number, options: WeatherSceneOptions, loop: number, y = .55) {
  const palette = weatherPalettes[options.kind];
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  for (let ring = 0; ring < 7; ring++) {
    const cycle = fract(loop + ring / 7); ctx.globalAlpha = (1 - cycle) * .19; ctx.strokeStyle = ring % 2 ? palette.primary : palette.accent;
    ctx.lineWidth = Math.max(1, width / 900); ctx.beginPath(); ctx.ellipse(width * .5, height * y, width * (.05 + cycle * .48), height * (.012 + cycle * .12), 0, 0, TAU); ctx.stroke();
  }
  ctx.restore();
}

function drawWindRibbons(ctx: CanvasRenderingContext2D, width: number, height: number, options: WeatherSceneOptions, loop: number, count = 12, turbulent = false) {
  const palette = weatherPalettes[options.kind];
  const direction = options.motionCue?.direction ?? 0;
  for (let index = 0; index < count; index++) {
    const y = height * (.12 + index / count * .76);
    const travel = options.reducedMotion ? 0 : ((fract(loop * (1 + index % 3 * .25) + random(options.seed, index + 2600)) - .5) * width * .22 + direction * width * .06);
    ctx.save(); ctx.translate(travel, 0);
    drawSoftRibbon(ctx, width, height, y, height * (turbulent ? .035 : .016), index % 3 ? palette.primary : palette.secondary, .05 + (index % 4) * .018, height * (.008 + (index % 3) * .005), loop * TAU * (turbulent && index % 2 ? -1 : 1) + index);
    ctx.restore();
  }
}

function drawAurora(ctx: CanvasRenderingContext2D, width: number, height: number, options: WeatherSceneOptions, loop: number, beatFold = false) {
  const palette = weatherPalettes[options.kind];
  const expansion = options.motionCue?.expansion ?? options.signals.openness / 100;
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  for (let band = 0; band < 7; band++) {
    const y = height * (.12 + band * .072);
    const beat = beatFold ? Math.pow(.5 + .5 * Math.sin(loop * TAU * 4), 4) : 0;
    drawSoftRibbon(ctx, width, height, y, height * (.025 + expansion * .025 + beat * .035), band % 2 ? palette.primary : palette.secondary, .06 + expansion * .045 + beat * .08, height * (.022 + expansion * .01 + band * .005), loop * TAU + band);
  }
  ctx.restore();
}

function drawRainbow(ctx: CanvasRenderingContext2D, width: number, height: number, options: WeatherSceneOptions, loop: number) {
  const colors = ["#ff518f", "#ffad42", "#fff061", "#4bf5ae", "#46b7ff", "#a46bff"];
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round";
  colors.forEach((color, index) => {
    ctx.strokeStyle = color; ctx.globalAlpha = .14; ctx.lineWidth = height * .018; ctx.shadowColor = color; ctx.shadowBlur = 22;
    ctx.beginPath(); ctx.ellipse(width * .5, height * (.68 + Math.sin(loop * TAU) * .01), width * (.36 + index * .025), height * (.32 + index * .018), Math.PI, Math.PI, TAU); ctx.stroke();
  });
  ctx.restore();
}

function drawCaustics(ctx: CanvasRenderingContext2D, width: number, height: number, options: WeatherSceneOptions, loop: number) {
  const palette = weatherPalettes[options.kind];
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  for (let row = 0; row < 10; row++) {
    ctx.beginPath();
    for (let step = 0; step <= 30; step++) {
      const x = width * step / 30, y = height * (.18 + row * .07) + Math.sin(step * .72 + row + loop * TAU) * height * .025;
      if (step) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.globalAlpha = .055 + row % 3 * .02; ctx.strokeStyle = row % 2 ? palette.primary : palette.accent; ctx.lineWidth = 1.5 + row % 3; ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 12; ctx.stroke();
  }
  ctx.restore();
}

function drawFloorFog(ctx: CanvasRenderingContext2D, width: number, height: number, options: WeatherSceneOptions, energy: number, loop: number) {
  drawFogBands(ctx, width, height, options, true); drawPressureRings(ctx, width, height, options, loop, .77);
  const palette = weatherPalettes.floorFog; ctx.save(); ctx.globalCompositeOperation = "lighter";
  for (let ray = 0; ray < 5; ray++) { ctx.strokeStyle = ray % 2 ? palette.primary : palette.secondary; ctx.globalAlpha = .08 + energy * .04; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, height * (.69 + ray * .035)); ctx.lineTo(width, height * (.66 + ray * .04)); ctx.stroke(); }
  ctx.restore();
}

function drawSlowHeatwave(ctx: CanvasRenderingContext2D, width: number, height: number, options: WeatherSceneOptions, energy: number, loop: number) {
  const palette = weatherPalettes.slowHeatwave; glowEllipse(ctx, width * .5, height * .72, width * .56, height * .3, palette.primary, .16 + energy * .07);
  ctx.save(); ctx.globalCompositeOperation = "screen";
  for (let col = 0; col < 16; col++) { const x = width * (col + .5) / 16; ctx.strokeStyle = col % 2 ? palette.primary : palette.secondary; ctx.globalAlpha = .06; ctx.lineWidth = width / 18; ctx.beginPath(); ctx.moveTo(x, height); for (let step = 0; step < 8; step++) ctx.lineTo(x + Math.sin(step + loop * TAU + col) * width * .018, height * (1 - step / 9)); ctx.stroke(); }
  ctx.restore();
}

function drawNeonCrosswind(ctx: CanvasRenderingContext2D, width: number, height: number, options: WeatherSceneOptions, loop: number) { drawWindRibbons(ctx, width, height, options, loop, 17); drawFogBands(ctx, width, height, options); }

function drawSoftThunder(ctx: CanvasRenderingContext2D, width: number, height: number, options: WeatherSceneOptions, motion: number, energy: number, loop: number) {
  const palette = weatherPalettes.softThunder; drawCloudVolume(ctx, width, height, options.seed, loop, palette.primary, palette.secondary, 1.1); drawRain(ctx, width, height, options, loop, Math.round(85 + motion * 70), false, .12);
  if (!options.reducedMotion) { const pulse = Math.pow(Math.max(0, Math.sin(loop * TAU * 3)), 14); if (pulse > .05) drawLightning(ctx, options.seed + Math.floor(loop * 12), width * .5, height * .14, height * .42, palette.accent, pulse * .55, false); }
}

function drawMidnightInversion(ctx: CanvasRenderingContext2D, width: number, height: number, options: WeatherSceneOptions, loop: number) {
  const palette = weatherPalettes.midnightInversion; drawCloudVolume(ctx, width, height, options.seed, 1 - loop, palette.secondary, palette.primary, 1.05); drawRain(ctx, width, height, options, loop, 100, true, -.08); drawPressureRings(ctx, width, height, options, 1 - loop, .38);
  const horizon = ctx.createLinearGradient(0, height * .42, 0, height * .6); horizon.addColorStop(0, "rgba(57,123,255,0)"); horizon.addColorStop(.5, "rgba(255,112,77,.2)"); horizon.addColorStop(1, "rgba(57,123,255,0)"); ctx.fillStyle = horizon; ctx.fillRect(0, height * .38, width, height * .25);
}

function drawAfterpartyRainbow(ctx: CanvasRenderingContext2D, width: number, height: number, options: WeatherSceneOptions, loop: number) { drawRainbow(ctx, width, height, options, loop); drawFogBands(ctx, width, height, options); drawRain(ctx, width, height, options, loop, 54, false, .08); }

function drawDancefloorCurrent(ctx: CanvasRenderingContext2D, width: number, height: number, options: WeatherSceneOptions, loop: number) { drawCaustics(ctx, width, height, options, loop); drawWindRibbons(ctx, width, height, options, loop, 8, true); drawPressureRings(ctx, width, height, options, loop, .7); }

function drawSupercell(ctx: CanvasRenderingContext2D, width: number, height: number, options: WeatherSceneOptions, energy: number, loop: number) {
  const palette = weatherPalettes.dancefloorSupercell; drawCloudVolume(ctx, width, height, options.seed, loop, palette.secondary, palette.primary, 1.55);
  ctx.save(); ctx.translate(width * .5, height * .43); ctx.globalCompositeOperation = "lighter";
  for (let ring = 0; ring < 15; ring++) { ctx.rotate((ring % 2 ? 1 : -1) * .12); ctx.strokeStyle = ring % 3 ? palette.secondary : palette.primary; ctx.globalAlpha = .08 + energy * .045; ctx.lineWidth = 2 + ring % 4; ctx.beginPath(); ctx.ellipse(0, ring * height * .018, width * (.3 - ring * .012), height * (.09 - ring * .002), loop * TAU + ring, 0, TAU); ctx.stroke(); }
  ctx.restore(); if (!options.reducedMotion) for (let strike = 0; strike < 3; strike++) drawLightning(ctx, options.seed + strike * 31 + Math.floor(loop * 12), width * (.25 + strike * .25), height * .1, height * .55, palette.accent, .25 + energy * .2, true);
}

function drawOnBeatAurora(ctx: CanvasRenderingContext2D, width: number, height: number, options: WeatherSceneOptions, loop: number) { drawAurora(ctx, width, height, options, loop, true); drawPressureRings(ctx, width, height, options, fract(loop * 4), .64); }

function drawArtificialSunrise(ctx: CanvasRenderingContext2D, width: number, height: number, options: WeatherSceneOptions, energy: number, loop: number) {
  const palette = weatherPalettes.artificialSunrise, horizon = height * .67; glowEllipse(ctx, width * .5, horizon, width * .55, height * .34, palette.primary, .2 + energy * .1);
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.strokeStyle = palette.accent; ctx.globalAlpha = .22; ctx.lineWidth = height * .014; ctx.shadowColor = palette.primary; ctx.shadowBlur = 35; ctx.beginPath(); ctx.arc(width * .5, horizon, Math.min(width, height) * (.2 + Math.sin(loop * TAU) * .008), Math.PI, TAU); ctx.stroke(); ctx.restore();
  drawCloudVolume(ctx, width, height, options.seed, loop, palette.secondary, palette.primary, .75); drawAurora(ctx, width, height, options, loop, false);
}

function drawAirTexture(ctx: CanvasRenderingContext2D, width: number, height: number, options: WeatherSceneOptions, energy: number, loop: number) {
  const palette = weatherPalettes[options.kind];
  const direction = options.motionCue?.direction ?? 0;
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  const count = options.reducedMotion ? 18 : 42;
  for (let index = 0; index < count; index++) {
    const x = fract(random(options.seed, index + 1200) + loop * (index % 3 ? .25 : -.25) + direction * loop * .12) * width;
    const y = fract(random(options.seed, index + 1300) - loop * (.25 + index % 4 * .08)) * height;
    const size = Math.max(1, Math.min(width, height) * (.0008 + random(options.seed, index + 1400) * .0022));
    ctx.globalAlpha = .06 + energy * .1; ctx.fillStyle = index % 2 ? palette.primary : palette.accent;
    ctx.beginPath(); ctx.arc(x, y, size, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

export function drawWeatherScene(canvas: HTMLCanvasElement, options: WeatherSceneOptions) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const width = canvas.width, height = canvas.height;
  const intensity = clamp01(options.intensity ?? 1);
  const cue = options.motionCue ?? {
    energy: options.signals.movement / 100,
    direction: 0,
    expansion: options.signals.openness / 100,
  };
  const motionEnergy = clamp01(cue.energy);
  const expansion = clamp01(cue.expansion);
  const direction = Math.max(-1, Math.min(1, cue.direction));
  const movement = clamp01(options.signals.movement / 100 * .68 + motionEnergy * .46) * intensity;
  const openness = clamp01(options.signals.openness / 100 * .62 + expansion * .5) * intensity;
  const stillness = clamp01(options.signals.stillness / 100);
  const energy = clamp01(.38 + intensity * .42 + motionEnergy * .2);
  const loop = fract(options.time / 4);
  fillBackground(ctx, width, height, options.kind);
  ctx.save();
  const weatherScale = 1 + expansion * .035;
  ctx.translate(width * (.5 + direction * .035), height * .5);
  ctx.scale(weatherScale, 1 + expansion * .018);
  ctx.translate(-width * .5, -height * .5);
  switch (options.kind) {
    case "electricStorm": drawElectricStorm(ctx, width, height, options, movement, energy, loop); break;
    case "openSky": drawOpenSky(ctx, width, height, options, openness, energy, loop); break;
    case "silentPressure": drawSilentPressure(ctx, width, height, options, stillness, energy, loop); break;
    case "localChaos": drawLocalChaos(ctx, width, height, options, movement, energy, loop); break;
    case "tipsyMonsoon": drawTipsyMonsoon(ctx, width, height, options, movement, energy, loop); break;
    case "floorFog": drawFloorFog(ctx, width, height, options, energy, loop); break;
    case "slowHeatwave": drawSlowHeatwave(ctx, width, height, options, energy, loop); break;
    case "neonCrosswind": drawNeonCrosswind(ctx, width, height, options, loop); break;
    case "softThunder": drawSoftThunder(ctx, width, height, options, movement, energy, loop); break;
    case "midnightInversion": drawMidnightInversion(ctx, width, height, options, loop); break;
    case "afterpartyRainbow": drawAfterpartyRainbow(ctx, width, height, options, loop); break;
    case "dancefloorCurrent": drawDancefloorCurrent(ctx, width, height, options, loop); break;
    case "dancefloorSupercell": drawSupercell(ctx, width, height, options, energy, loop); break;
    case "onBeatAurora": drawOnBeatAurora(ctx, width, height, options, loop); break;
    case "artificialSunrise": drawArtificialSunrise(ctx, width, height, options, energy, loop); break;
  }
  drawAirTexture(ctx, width, height, options, energy, loop);
  ctx.restore();
  drawOpticalFinish(ctx, width, height, options.kind, options.seed, energy);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.shadowBlur = 0;
}

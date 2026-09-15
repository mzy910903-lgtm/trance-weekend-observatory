"use client";

import Link from "next/link";
import { trackRaveWeatherEvent } from "@/lib/rave-weather-events";

export function RaveWeatherEntryCard() {
  return (
    <Link
      href="/rave-weather"
      onClick={() => trackRaveWeatherEvent("home_entry")}
      className="group relative flex min-h-32 overflow-hidden rounded border border-fuchsia-300/20 bg-[#09070d] p-5 transition hover:border-cyan-200/50"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_30%,rgba(34,211,238,.22),transparent_36%),radial-gradient(circle_at_88%_70%,rgba(244,114,182,.22),transparent_38%)] opacity-80 transition group-hover:opacity-100" />
      <div className="relative flex w-full items-end justify-between gap-5">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.34em] text-cyan-200">Rave Weather · Live Experiment</p>
          <h3 className="mt-3 text-2xl font-semibold tracking-tight text-white">今晚，你是什么天气？</h3>
          <p className="mt-2 text-xs text-zinc-400">42 秒动作挑战，生成一张可以带走的内在天气。</p>
        </div>
        <span className="shrink-0 font-mono text-xs text-fuchsia-200 transition group-hover:translate-x-1">进入 ↗</span>
      </div>
    </Link>
  );
}

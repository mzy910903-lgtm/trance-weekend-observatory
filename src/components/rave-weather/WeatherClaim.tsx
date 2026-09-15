"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Atmosphere from "./Atmosphere";
import HighlightLoop from "./HighlightLoop";
import { emptyBeat, emptyCombo } from "./interaction";
import { prepareWeatherMedia, downloadWeatherMedia, weatherMediaFilename, type PreparedWeatherMedia } from "./weather-media";
import { weatherNameZh, weatherQuoteZh, weatherShareText, weatherVisualKind, type Weather } from "./weather";
import { trackRaveWeatherEvent } from "@/lib/rave-weather-events";

type Preparation = "preparing" | "ready" | "fallback" | "error";

export default function WeatherClaim({ weather, shareId, shareUrl }: { weather: Weather; shareId?: string; shareUrl: string }) {
  const [prepared, setPrepared] = useState<PreparedWeatherMedia | null>(null);
  const [preparation, setPreparation] = useState<Preparation>("preparing");
  const [sharing, setSharing] = useState(false);
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const [mediaUrl, setMediaUrl] = useState("");
  const [notice, setNotice] = useState("");
  const claimed = useRef(false);
  const kind = weatherVisualKind(weather);

  useEffect(() => {
    trackRaveWeatherEvent("shared_view", kind);
    if (!shareId || claimed.current) return;
    claimed.current = true;
    void fetch(`/api/rave-weather/shares/${encodeURIComponent(shareId)}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
      keepalive: true,
    }).then(response => {
      if (response.ok) trackRaveWeatherEvent("qr_claimed", kind);
    }).catch(() => undefined);
  }, [kind, shareId]);

  useEffect(() => {
    let cancelled = false;
    void prepareWeatherMedia(weather).then(({ media, fallback }) => {
      if (cancelled) return;
      setPrepared(media);
      setPreparation(fallback ? "fallback" : "ready");
      trackRaveWeatherEvent("share_ready", `${kind}_${media.extension}`);
    }).catch(() => {
      if (!cancelled) setPreparation("error");
    });
    return () => { cancelled = true; };
  }, [kind, weather]);

  useEffect(() => () => { if (mediaUrl) URL.revokeObjectURL(mediaUrl); }, [mediaUrl]);

  const openFallback = (reason: string) => {
    if (!prepared) return;
    if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    setMediaUrl(URL.createObjectURL(prepared.blob));
    setFallbackOpen(true);
    setNotice(prepared.mimeType.startsWith("video/") ? "视频已经在手机里生成。可以播放后保存，或用系统浏览器打开本页再分享。" : "此浏览器将使用静态天气封面。");
    trackRaveWeatherEvent("share_fallback", `${kind}_${reason}`);
  };

  const shareWeather = async () => {
    if (!prepared) return;
    const file = new File([prepared.blob], `${weatherMediaFilename(weather)}.${prepared.extension}`, { type: prepared.mimeType });
    const shareData: ShareData = {
      title: `${weatherNameZh(weather)} · RAVE WEATHER`,
      text: `${weatherShareText(weather)}\n${shareUrl}`,
      files: [file],
    };
    let supported = typeof navigator.share === "function";
    try { if (navigator.canShare) supported = navigator.canShare(shareData); } catch { supported = false; }
    if (!supported) { openFallback("unsupported"); return; }
    setSharing(true);
    try {
      const sharingPromise = navigator.share(shareData);
      trackRaveWeatherEvent("mobile_share_opened", `${kind}_${prepared.extension}`);
      await sharingPromise;
      trackRaveWeatherEvent("mobile_share_complete", kind);
      setNotice("这场天气已经交给系统分享菜单。");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      const reason = error instanceof Error ? error.name || "share" : "share";
      trackRaveWeatherEvent("share_failed", `${kind}_${reason}`);
      openFallback(reason);
    } finally {
      setSharing(false);
    }
  };

  const download = () => {
    if (!prepared) return;
    downloadWeatherMedia(prepared, weather);
    trackRaveWeatherEvent("mobile_download", kind);
    setNotice(prepared.mimeType.startsWith("video/") ? "4 秒天气已开始保存。iPhone 可在下载项目中打开后存入相册。" : "天气封面已开始保存。");
  };

  return <main className="rw rw-mobile-claim">
    <Atmosphere signals={weather.signals} phase={weather.phase} seed={weather.seed} visualKind={kind} transitionProgress={0} sessionProgress={1} beatState={emptyBeat} comboState={emptyCombo} lastGesture={null} />
    {weather.highlight && <HighlightLoop highlight={weather.highlight} weather={weather} />}
    <div className="rw-vignette" />
    <header className="rw-header"><Link href="/rave-weather" className="rw-brand">RAVE<br />WEATHER<span>®</span></Link><div className="rw-edition">TRANCEWEEKEND<span>天气领取处</span></div><span className="rw-claim-secure">7 DAYS</span></header>
    <section className="rw-mobile-claim-content">
      <p className="rw-eyebrow">这场天气已经落到你手机里</p>
      <h1 className="rw-result-name">{weatherNameZh(weather)}</h1>
      <p className="rw-result-english">{weather.name}</p>
      <p className="rw-verdict">{weatherQuoteZh(weather)}</p>
      <div className={`rw-mobile-preparation ${preparation}`}><i /><span>{preparation === "preparing" ? "正在生成 4 秒天气视频…" : preparation === "ready" ? "4 秒纯天气已就绪" : preparation === "fallback" ? "已准备天气封面" : "当前浏览器无法生成文件"}</span></div>
      <button className="rw-primary rw-mobile-share" onClick={shareWeather} disabled={!prepared || sharing}>{sharing ? "系统分享菜单已打开…" : preparation === "preparing" ? "天气生成中…" : "保存 / 分享我的天气"}<span>↗</span></button>
      <button className="rw-text-button" onClick={download} disabled={!prepared}>直接下载{prepared?.mimeType.startsWith("video/") ? "视频" : "天气封面"} ↗</button>
      <p className="rw-mobile-tip">微信内如果没有出现分享菜单，请点右上角 ···，选择“在浏览器打开”。</p>
      <Link className="rw-text-button rw-mobile-retry" href="/rave-weather">再生成一种天气 ↻</Link>
      {notice && <p className="rw-mobile-notice" role="status">{notice}</p>}
    </section>
    {fallbackOpen && prepared && <div className="rw-share-fallback" role="dialog" aria-modal="true" aria-label="保存专属天气"><div className="rw-share-fallback-card"><div className="rw-panel-title">把天气带走<button aria-label="关闭保存窗口" onClick={() => setFallbackOpen(false)}>×</button></div>{prepared.mimeType.startsWith("video/") ? <video src={mediaUrl} controls playsInline autoPlay muted loop /> : <Image unoptimized src={mediaUrl} width={720} height={1280} alt="专属天气封面" />}<p>微信内置浏览器通常不开放文件分享。播放视频后尝试长按保存；如果没有保存选项，请用右上角菜单在系统浏览器打开本页。</p><div><a className="rw-primary" href={mediaUrl} download={`${weatherMediaFilename(weather)}.${prepared.extension}`} onClick={() => trackRaveWeatherEvent("mobile_download", kind)}>{prepared.mimeType.startsWith("video/") ? "打开并保存视频" : "保存天气封面"}<span>↗</span></a><button className="rw-text-button" onClick={async () => { try { await navigator.clipboard.writeText(shareUrl); setNotice("天气链接已复制。请在系统浏览器打开。"); } catch { setNotice(shareUrl); } }}>复制链接 ↗</button></div></div></div>}
  </main>;
}

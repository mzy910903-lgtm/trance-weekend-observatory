import type { Metadata } from "next";
import Link from "next/link";
import WeatherClaim from "@/components/rave-weather/WeatherClaim";
import { getRaveWeatherShare, raveWeatherShareUrl } from "@/lib/rave-weather-shares";
import { weatherNameZh, weatherQuoteZh } from "@/components/rave-weather/weather";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const weather = await getRaveWeatherShare(id);
  if (!weather) return { title: "这场天气已经散了 · RAVE WEATHER" };
  const title = `${weatherNameZh(weather)} · RAVE WEATHER`;
  const description = weatherQuoteZh(weather);
  const url = raveWeatherShareUrl(id);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "website",
      siteName: "TRANCEWEEKEND · RAVE WEATHER",
      images: [{ url: `${url}/opengraph-image`, width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", title, description, images: [`${url}/opengraph-image`] },
  };
}

export default async function SharedWeatherPage({ params }: Props) {
  const { id } = await params;
  const weather = await getRaveWeatherShare(id);
  if (weather) return <WeatherClaim weather={weather} shareId={id} shareUrl={raveWeatherShareUrl(id)} />;
  return (
    <main className="rw rw-expired">
      <section className="rw-center">
        <p className="rw-eyebrow">RAVE WEATHER · 7 DAY FORECAST</p>
        <h1>这场天气<br />已经散了。</h1>
        <p className="rw-subtitle">短链接只保留七天。今晚可以重新生成。</p>
        <div className="rw-entry"><Link className="rw-primary" href="/rave-weather">生成我的天气 <span>↗</span></Link></div>
      </section>
    </main>
  );
}

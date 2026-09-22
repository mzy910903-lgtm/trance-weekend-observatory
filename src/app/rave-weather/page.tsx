import type { Metadata } from "next";
import Experience from "@/components/rave-weather/Experience";
export const metadata: Metadata = {
  title: "RAVE WEATHER — TRANCEWEEKEND",
  description: "挥手会放电，展开身体会打开天空。用 30 秒生成你今晚的内在天气。",
  openGraph: {
    title: "今晚，你是什么天气？",
    description: "30 秒动作挑战，生成一场只属于你的霓虹天气。",
    type: "website",
    siteName: "TRANCEWEEKEND · RAVE WEATHER",
  },
};
export default function Page() { return <Experience />; }

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  async headers() {
    const cache = [{ key: "Cache-Control", value: "public, max-age=86400, s-maxage=31536000, stale-while-revalidate=604800" }];
    return [
      { source: "/rave-weather/pose_landmarker_lite.task", headers: cache },
      { source: "/rave-weather/wasm/:asset*", headers: cache },
    ];
  },
};

export default nextConfig;

import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: ["127.0.0.1"],
  async headers() {
    return [
      // the life video's segments: cache them for a week so rewatching or
      // seeking back doesn't download them again
      {
        source: "/media/life/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }],
      },
      // playlists: short, so a re-encoded video shows up within the hour
      {
        source: "/media/life/:path*.m3u8",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600" }],
      },
    ];
  },
};
export default config;

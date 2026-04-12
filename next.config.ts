import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
};

import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore — skipWaiting is a valid runtime option but missing from typedefs in this version
  skipWaiting: true,
});

export default withPWA(nextConfig);

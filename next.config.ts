import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the test server use its own build directory so it never clashes
  // with a developer's `npm run dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  serverExternalPackages: ["better-sqlite3"],
  // Task pages are never cached by the browser (including its back/forward
  // cache), so the back button after signing out cannot show them.
  async headers() {
    return [{ source: "/tasks/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] }];
  },
};

export default nextConfig;

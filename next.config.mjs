/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow a separate build dir (e.g. the Claude preview server) so two dev
  // servers on the same checkout never share — and corrupt — one `.next`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Hide the floating Next.js dev-tools indicator in the local demo.
  devIndicators: false,
  webpack: (config, { dev }) => {
    if (dev) {
      // Webpack's on-disk cache intermittently corrupts here (pack.gz rename
      // races), which surfaces as "__webpack_modules__[moduleId] is not a
      // function" 500s on navigation. An in-memory dev cache avoids the
      // filesystem entirely — no corruption, at the cost of slower cold starts.
      config.cache = { type: "memory" };
    }
    return config;
  },
};

export default nextConfig;

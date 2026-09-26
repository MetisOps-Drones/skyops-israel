/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      {
        protocol: "https",
        hostname: "api.mapbox.com",
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
    // Every route under (app)/ is dynamic (its layout reads cookies for
    // auth), so Next's default dynamic staleTime of 0 meant re-entering any
    // page — even seconds after leaving it, still signed in, nothing
    // changed — re-ran the whole server round trip (auth check, profile
    // fetch) from scratch every time. This lets the client Router Cache
    // reuse that render for 30s, matching the React Query staleTime
    // (providers.tsx) so both layers agree on "how fresh is fresh enough" —
    // a page opened again inside that window is instant, and it quietly
    // re-fetches on its own past that, never a forced/stale-forever cache.
    staleTimes: {
      dynamic: 30,
    },
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // face-api.js's env detection does a guarded `require('fs')` for its
      // Node-only file-loading path (never reached in the browser, which
      // uses loadFromUri/fetch instead — see src/lib/face-match/faceMatch.ts),
      // and its tfjs-core dependency pulls in node-fetch's optional
      // 'encoding' package the same way. Harmless at runtime (confirmed
      // live), but webpack still emits a "Module not found" warning on
      // every build without these fallbacks — this is the standard fix for
      // that exact, well-documented combination.
      config.resolve.fallback = { ...config.resolve.fallback, fs: false, encoding: false };
    }
    return config;
  },
};

export default nextConfig;

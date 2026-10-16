import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // A stray lockfile in the parent folder confuses workspace-root detection.
  outputFileTracingRoot: path.join(__dirname),
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'play.pokemonshowdown.com',
        port: '',
        pathname: '/sprites/**',
      },
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
        port: '',
        pathname: '/PokeAPI/sprites/**',
      },
    ],
  },
};

export default nextConfig;

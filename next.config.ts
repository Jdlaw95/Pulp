import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tailwind v4 needs this loader hooked up for CSS files under Turbopack.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

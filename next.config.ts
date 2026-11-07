import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PDF exports run on the server; keep jsPDF out of the bundler (it has optional browser-only imports).
  serverExternalPackages: ["jspdf", "jspdf-autotable"],
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

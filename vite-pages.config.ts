import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const projectRoot = __dirname;

export default defineConfig({
  root: path.join(projectRoot, "pages"),
  base: "/data-dashboard/",
  publicDir: false,
  plugins: [react()],
  resolve: {
    alias: {
      "next/link": path.join(projectRoot, "pages", "next-link.tsx"),
    },
  },
  css: {
    postcss: path.join(projectRoot, "postcss.config.mjs"),
  },
  define: {
    __DASHBOARD_RELEASE_ID__: JSON.stringify(
      process.env.DASHBOARD_RELEASE_ID ?? "github-pages",
    ),
  },
  build: {
    outDir: path.join(projectRoot, "work", "github-pages-stage", "data-dashboard"),
    emptyOutDir: true,
  },
});

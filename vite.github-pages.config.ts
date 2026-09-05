import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const projectRoot = import.meta.dirname;

export default defineConfig({
  root: path.join(projectRoot, "github-pages"),
  base: "./",
  define: {
    __LEXI_STATIC_BUILD__: "true",
    __LEXI_CONFIGURED_BACKEND__: JSON.stringify(process.env.LEXI_BACKEND_URL ?? ""),
  },
  publicDir: false,
  resolve: {
    alias: {
      "@": projectRoot,
    },
  },
  plugins: [react()],
  css: {
    postcss: path.join(projectRoot, "postcss.config.mjs"),
  },
  build: {
    target: "es2022",
    outDir: projectRoot,
    emptyOutDir: false,
    copyPublicDir: false,
    assetsDir: "github-pages-assets",
    rollupOptions: {
      output: {
        entryFileNames: "github-pages-assets/lexi.js",
        chunkFileNames: "github-pages-assets/[name].js",
        assetFileNames: "github-pages-assets/[name][extname]",
      },
    },
  },
});

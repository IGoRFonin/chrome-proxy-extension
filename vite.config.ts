import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { copyFileSync } from "fs";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "copy-files",
      writeBundle() {
        copyFileSync("public/icon-16.png", "dist/icon-16.png");
        copyFileSync("public/icon-19.png", "dist/icon-19.png");
        copyFileSync("public/icon-32.png", "dist/icon-32.png");
        copyFileSync("public/icon-38.png", "dist/icon-38.png");
        copyFileSync("public/icon-48.png", "dist/icon-48.png");
        copyFileSync("public/icon-128.png", "dist/icon-128.png");
        copyFileSync("manifest.json", "dist/manifest.json");
        copyFileSync("schema.json", "dist/schema.json");
      },
    },
  ],
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "popup.html"),
        background: resolve(__dirname, "src/background.ts"),
        "content-script": resolve(__dirname, "src/content-script.ts"),
      },
      output: {
        entryFileNames: "[name].js",
      },
    },
  },
});

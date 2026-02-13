import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// https://vite.dev/config/

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Tauri dev server config
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      ignored: [
        "**/src-tauri/**",
        "**/docs/**",
        "**/wiki/**",
        "**/REVIEW.md",
        "**/AGENTS.md",
        "**/CLAUDE.md",
      ],
    },
  },
});

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        content: "src/content.tsx", // Your new entry point
      },
      output: {
        entryFileNames: "[name].js", // Force name to be content.js
        assetFileNames: "assets/[name].[ext]",
      },
    },
    // Ensure CSS is injected into JS so we can use ?inline
    cssCodeSplit: false,
  },
});

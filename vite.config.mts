import path from "node:path"

import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        admin: path.resolve(import.meta.dirname, "./admin.html"),
        blocked: path.resolve(import.meta.dirname, "./block-img.html"),
        main: path.resolve(import.meta.dirname, "./index.html"),
        pending: path.resolve(import.meta.dirname, "./whitelist-on.html"),
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
})

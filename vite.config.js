import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: {
      // `vite --mode mock` memakai data tiruan (untuk uji coba tanpa Supabase).
      "@api": resolve(__dirname, mode === "mock" ? "src/admin/api.mock.js" : "src/admin/api.js"),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        admin: resolve(__dirname, "admin/index.html"),
      },
    },
  },
}));

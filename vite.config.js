import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // PWA: манифест + service worker (Workbox, generateSW)
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/apple-touch-icon.png"],
      manifest: {
        name: "ВКС Расписание",
        short_name: "ВКС",
        description: "Управление видеоконференциями: расписание, протоколы, задачи, RSVP",
        lang: "ru",
        theme_color: "#2563eb",
        background_color: "#0f172a",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
        // Офлайн-политика: статика — cache-first; API — только сеть (без кеша
        // авторизованных ответов: безопасность + отсутствие устаревших данных).
        navigateFallback: "/index.html",
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
            // NetworkOnly: авторизованные ответы API НЕ кешируются service worker'ом.
            // Раньше был NetworkFirst с фолбэком в кэш — при 401 (истёкший токен)
            // приложение показывало устаревшее расписание из api-cache, а сам кэш
            // разрастался и «тормозил» браузер. Без сети API вернёт понятную ошибку.
            handler: "NetworkOnly",
          },
          {
            // Статика (иконки, шрифты): cache-first — ускоряет повторные загрузки.
            urlPattern: ({ url }) => /^(png|svg|woff2|ttf|ico)$/.test(url.pathname.split(".").pop() || ""),
            handler: "CacheFirst",
            options: {
              cacheName: "static-cache",
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  base: "./",
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: false,
    hmr: {
      port: 5173,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Разделяем тяжёлые vendor-библиотеки на отдельные кэшируемые чанки
        manualChunks(id) {
          if (id.includes("node_modules")) {
            // exceljs (~1 МБ) — отдельным ленивым чанком: подгружается только
            // при экспорте в Excel (см. utils/export.ts), не тормозит старт.
            if (id.includes("exceljs")) return "xlsx";
            return "vendor";
          }
        },
      },
    },
  },
});

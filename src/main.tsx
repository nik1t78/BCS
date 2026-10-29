import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

// PWA: регистрация service worker (vite-plugin-pwa, virtual модуль).
// Даёт офлайн-заглушку для ТВ/клиентов при недоступности сервера и
// автообновление кэша статики (registerType: autoUpdate).
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    import(/* @vite-ignore */ "virtual:pwa-register")
      .then(({ registerSW }) => registerSW({ immediate: true }))
      .catch(() => {});
  });
}

// Данные берутся из Laravel API (store-api.ts). Демо-данные в localStorage
// больше не пишутся — это чинило «подвисание» браузеров у пользователей.
ReactDOM.createRoot(document.getElementById("root")!).render(<App />);

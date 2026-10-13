import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

// Данные берутся из Laravel API (store-api.ts). Демо-данные в localStorage
// больше не пишутся — это чинило «подвисание» браузеров у пользователей.
ReactDOM.createRoot(document.getElementById("root")!).render(<App />);

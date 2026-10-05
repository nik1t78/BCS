import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { initializeDemoData } from "./store";

// Initialize demo data on first load
initializeDemoData();

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);

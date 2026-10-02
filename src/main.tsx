import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import { STORAGE_KEY } from "@domain/schema";

try {
  const params = new URLSearchParams(window.location.search);
  if (params.has("reset")) {
    localStorage.removeItem(STORAGE_KEY);
  }
} catch {}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

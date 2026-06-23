import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { GLOBAL_CSS } from "./styles.js";

// Inject the global stylesheet (fonts, halftone background, @keyframes) once.
const style = document.createElement("style");
style.textContent = GLOBAL_CSS;
document.head.appendChild(style);

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

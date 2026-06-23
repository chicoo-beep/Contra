import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
//
// `base` matters for GitHub Pages: a project site is served from
// https://<user>.github.io/Contra/, so built asset URLs must be prefixed with
// "/Contra/". Local dev stays at "/" so http://localhost:5173 works normally.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === "build" ? "/Contra/" : "/",
}));

// Single source of truth for the retro-futuristic look.
// Pure CSS-in-JS: a palette, reusable style objects, and a global stylesheet
// string (injected once in main.jsx) for things inline styles can't express —
// @keyframes, the halftone background, and the monospaced font default.

export const palette = {
  cream: "#efe7d4", // aged paper
  navy: "#1a2340", // deep ink
  orange: "#c9551a", // muted rubber-stamp orange
  creamDark: "#e2d7bd",
  navySoft: "rgba(26, 35, 64, 0.12)",
};

export const mono = `"Courier New", "DejaVu Sans Mono", ui-monospace, monospace`;

// Halftone = a dotted radial-gradient tile. Used on the page + panels.
const halftone = (dot, size) =>
  `radial-gradient(${dot} 1.4px, transparent 1.6px)` +
  ` 0 0 / ${size}px ${size}px`;

export const GLOBAL_CSS = `
  * { box-sizing: border-box; }
  html, body, #root { margin: 0; min-height: 100%; }
  body {
    font-family: ${mono};
    color: ${palette.navy};
    background-color: ${palette.cream};
    background-image: ${halftone("rgba(26,35,64,0.10)", 18)};
    -webkit-font-smoothing: none;
  }
  @keyframes rr-spin {
    0%   { transform: translateY(0) rotate(-2deg); opacity: 0.35; }
    50%  { transform: translateY(-6px) rotate(2deg); opacity: 1; }
    100% { transform: translateY(0) rotate(-2deg); opacity: 0.35; }
  }
  @keyframes rr-stamp {
    0%   { transform: scale(1.6) rotate(-8deg); opacity: 0; }
    60%  { transform: scale(0.94) rotate(3deg); opacity: 1; }
    100% { transform: scale(1) rotate(-2deg); opacity: 1; }
  }
  button:focus-visible { outline: 3px dashed ${palette.orange}; outline-offset: 2px; }
`;

// "Rubber stamp" button: thick border, uppercase, slight rotation, hard shadow.
export const stampButton = (accent = palette.orange) => ({
  fontFamily: mono,
  fontWeight: 700,
  fontSize: "1rem",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: palette.cream,
  background: accent,
  border: `3px solid ${palette.navy}`,
  padding: "0.7rem 1.4rem",
  cursor: "pointer",
  transform: "rotate(-2deg)",
  boxShadow: `5px 5px 0 ${palette.navy}`,
  transition: "transform 0.08s ease, box-shadow 0.08s ease",
});

export const stampButtonActive = {
  transform: "rotate(-2deg) translate(3px, 3px)",
  boxShadow: `2px 2px 0 ${palette.navy}`,
};

export const panel = {
  background: palette.cream,
  border: `3px solid ${palette.navy}`,
  boxShadow: `6px 6px 0 ${palette.navySoft}`,
  padding: "1.25rem",
};

export const tag = {
  display: "inline-block",
  border: `2px solid ${palette.navy}`,
  background: palette.creamDark,
  padding: "0.15rem 0.55rem",
  fontSize: "0.8rem",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};
